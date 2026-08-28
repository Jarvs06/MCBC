import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/*
 * ========================================
 * Code normalization / hashing
 * ========================================
 *
 * Kept in sync with create-admin-user and
 * regenerate-admin-activation-code, which generate codes the
 * same way.
 */
function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]+/g, "");
}

async function hashCode(normalized: string): Promise<string> {
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/*
 * ========================================
 * Rate limiting
 * ========================================
 *
 * verify-activation-code has no caller session to key a limit
 * on — anyone can call it, that's the point — so this is keyed
 * on the caller's IP address instead. Fixed 15-minute window,
 * no external dependency. Kept in sync with the copy of this
 * logic in complete-admin-activation.
 */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 10;

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");

  return forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
}

async function isWithinRateLimit(
  // deno-lint-ignore no-explicit-any
  admin: any,
  ip: string,
  action: "verify_code" | "complete_activation",
  max: number
): Promise<boolean> {
  const windowStart = new Date(
    Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS
  ).toISOString();

  /*
   * Opportunistic cleanup of old buckets. Best-effort — failure
   * here should never block the actual rate-limit check.
   */
  await admin
    .from("activation_rate_limits")
    .delete()
    .lt("window_start", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const { data: existing } = await admin
    .from("activation_rate_limits")
    .select("id, attempt_count")
    .eq("ip_address", ip)
    .eq("action", action)
    .eq("window_start", windowStart)
    .maybeSingle();

  if (existing) {
    const nextCount = existing.attempt_count + 1;

    await admin
      .from("activation_rate_limits")
      .update({ attempt_count: nextCount, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    return nextCount <= max;
  }

  try {
    await admin
      .from("activation_rate_limits")
      .insert({ ip_address: ip, action, window_start: windowStart, attempt_count: 1 });
  } catch (error) {
    /*
     * Extremely unlikely concurrent-insert race on the same
     * ip+action+window. Not worth failing the request over —
     * this is a low-traffic admin tool, not a high-QPS surface.
     */
    console.error("Rate limit bucket insert race:", error);
  }

  return true;
}

/*
 * ========================================
 * NOTE ON AUTHORIZATION
 * ========================================
 *
 * Unlike every other Edge Function in this project, this one
 * does NOT call supabase.auth.getUser() to identify a caller —
 * there is no caller session yet. Whoever holds the correct
 * activation code IS the authorization, not a JWT identity. Do
 * not "fix" this by adding a getUser() check; it would break
 * the activation flow entirely, since a brand-new administrator
 * has no session at this point.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing required Supabase environment variables.");
      return jsonResponse({ error: "Server configuration error." }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const clientIp = getClientIp(req);

    const withinLimit = await isWithinRateLimit(
      supabaseAdmin,
      clientIp,
      "verify_code",
      MAX_VERIFY_ATTEMPTS
    );

    if (!withinLimit) {
      return jsonResponse(
        { error: "Too many attempts. Please try again later." },
        429
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const rawCode = typeof body.code === "string" ? body.code : "";

    if (!rawCode.trim()) {
      return jsonResponse({ error: "Activation code is required." }, 400);
    }

    const codeHash = await hashCode(normalizeCode(rawCode));

    const { data: codeRecord, error: codeError } = await supabaseAdmin
      .from("admin_activation_codes")
      .select("id, admin_id, expires_at, used_at")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (codeError) {
      console.error("Activation code lookup error:", codeError);
      return jsonResponse({ error: "Unexpected server error." }, 500);
    }

    if (!codeRecord) {
      return jsonResponse({ error: "Invalid activation code." }, 400);
    }

    if (codeRecord.used_at) {
      return jsonResponse(
        { error: "This activation code has already been used." },
        400
      );
    }

    if (new Date(codeRecord.expires_at).getTime() <= Date.now()) {
      return jsonResponse(
        { error: "This activation code has expired." },
        400
      );
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("admin_profiles")
      .select("id, full_name, role, status")
      .eq("id", codeRecord.admin_id)
      .maybeSingle();

    if (targetProfileError || !targetProfile || targetProfile.status !== "Pending") {
      return jsonResponse(
        { error: "This account is no longer eligible for activation." },
        400
      );
    }

    const { data: authUserData, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(targetProfile.id);

    if (authUserError || !authUserData.user?.email) {
      console.error("Target Auth user lookup error:", authUserError);
      return jsonResponse(
        { error: "This account is no longer eligible for activation." },
        400
      );
    }

    /*
     * Minimum information needed by the frontend to display a
     * confirmation and, after password creation, sign in. Never
     * returns the code hash, admin_id, or any other internal
     * record details.
     */
    return jsonResponse({
      success: true,
      admin: {
        full_name: targetProfile.full_name,
        email: authUserData.user.email,
        role: targetProfile.role,
      },
    });
  } catch (error) {
    console.error("Verify activation code unexpected error:", error);
    return jsonResponse({ error: "Unexpected server error." }, 500);
  }
});
