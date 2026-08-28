import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/*
 * Kept in sync with src/lib/validators.ts (MIN_PASSWORD_LENGTH).
 * Edge functions can't import from the app bundle, so this is
 * duplicated the same way set-admin-password already does.
 */
const MIN_PASSWORD_LENGTH = 8;

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
 * Kept in sync with create-admin-user, regenerate-admin-activation-code,
 * and verify-activation-code, which all handle codes the same way.
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
 * Kept in sync with the copy of this logic in
 * verify-activation-code. A lower max here than verify's, since
 * completing activation is the more consequential of the two
 * calls.
 */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_COMPLETE_ATTEMPTS = 5;

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
    console.error("Rate limit bucket insert race:", error);
  }

  return true;
}

/*
 * ========================================
 * NOTE ON AUTHORIZATION
 * ========================================
 *
 * Same as verify-activation-code: no caller session exists yet,
 * so there is deliberately no supabase.auth.getUser() call here.
 * Possession of the correct, unexpired, unused activation code
 * IS the authorization.
 *
 * This function accepts ONLY { code, password } — never a
 * client-supplied admin_id. Accepting one would let anyone
 * activate any Pending account by guessing its (non-secret) UUID,
 * without ever knowing the actual code.
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
      "complete_activation",
      MAX_COMPLETE_ATTEMPTS
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
    const password = typeof body.password === "string" ? body.password : "";

    if (!rawCode.trim()) {
      return jsonResponse({ error: "Activation code is required." }, 400);
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonResponse(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        400
      );
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
      .select("id, status")
      .eq("id", codeRecord.admin_id)
      .maybeSingle();

    if (targetProfileError || !targetProfile || targetProfile.status !== "Pending") {
      return jsonResponse(
        { error: "This account is no longer eligible for activation." },
        400
      );
    }

    /*
     * ========================================
     * Atomically claim the code
     * ========================================
     *
     * Closes the race window between the checks above and this
     * point — e.g. two concurrent submissions of the same code.
     * Only a request that actually flips used_at from NULL wins;
     * everyone else gets the generic "already used" error below,
     * even if their own checks above happened to pass.
     */
    const nowIso = new Date().toISOString();

    const { data: claimedRecord, error: claimError } = await supabaseAdmin
      .from("admin_activation_codes")
      .update({ used_at: nowIso })
      .eq("id", codeRecord.id)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .select("id, admin_id")
      .maybeSingle();

    if (claimError) {
      console.error("Activation code claim error:", claimError);
      return jsonResponse({ error: "Unexpected server error." }, 500);
    }

    if (!claimedRecord) {
      return jsonResponse(
        { error: "This activation code has already been used or has expired." },
        400
      );
    }

    /*
     * ========================================
     * Set the password
     * ========================================
     *
     * `email_confirm: true` because completing activation this
     * way should let the account sign in immediately afterward,
     * same as set-admin-password already does for its own
     * fallback path.
     */
    const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
      claimedRecord.admin_id,
      {
        password,
        email_confirm: true,
      }
    );

    if (updatePasswordError) {
      console.error("Set password during activation error:", updatePasswordError);
      return jsonResponse(
        { error: "Unable to set the administrator's password." },
        500
      );
    }

    /*
     * ========================================
     * Activate the profile
     * ========================================
     *
     * If this specific update fails after the password was
     * already set above, the account is left with a working
     * password but status still "Pending" — set-admin-password
     * (Super Admin only) already flips Pending -> Active as part
     * of setting a password, so it doubles as the recovery path
     * for this rare partial-failure case. No separate recovery
     * code needed here.
     */
    const { error: activateError } = await supabaseAdmin
      .from("admin_profiles")
      .update({ status: "Active", updated_at: nowIso })
      .eq("id", claimedRecord.admin_id);

    if (activateError) {
      console.error("Activate profile after code completion error:", activateError);
      return jsonResponse(
        {
          error:
            "Your password was set, but your account could not be activated. Please contact your administrator.",
        },
        500
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Complete admin activation unexpected error:", error);
    return jsonResponse({ error: "Unexpected server error." }, 500);
  }
});
