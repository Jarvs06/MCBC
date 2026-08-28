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
 * Activation code
 * ========================================
 *
 * Kept in sync with create-admin-user, which generates a code
 * the same way when an admin is first created.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 10;
const CODE_EXPIRY_MS = 24 * 60 * 60 * 1000;

function generateActivationCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);

  let code = "";

  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }

  return code;
}

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

Deno.serve(async (req: Request) => {
  /*
   * ========================================
   * CORS
   * ========================================
   */
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  /*
   * ========================================
   * Method
   * ========================================
   */
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    /*
     * ========================================
     * Environment
     * ========================================
     */
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing required Supabase environment variables.");
      return jsonResponse({ error: "Server configuration error." }, 500);
    }

    /*
     * ========================================
     * Authorization
     * ========================================
     */
    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse({ error: "Authorization required." }, 401);
    }

    /*
     * ========================================
     * Verify caller's JWT
     * ========================================
     */
    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authorization } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user: caller },
      error: callerAuthError,
    } = await supabaseAuth.auth.getUser();

    if (callerAuthError || !caller) {
      console.error("Caller authentication error:", callerAuthError);
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    /*
     * ========================================
     * Service-role client
     * ========================================
     */
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    /*
     * ========================================
     * Check caller profile
     * ========================================
     */
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from("admin_profiles")
      .select("id, role, status, approved")
      .eq("id", caller.id)
      .single();

    if (callerProfileError || !callerProfile) {
      console.error("Caller profile error:", callerProfileError);
      return jsonResponse({ error: "Administrator profile not found." }, 403);
    }

    /*
     * ========================================
     * Super Admin authorization
     * ========================================
     */
    if (
      callerProfile.role !== "Super Admin" ||
      callerProfile.status !== "Active" ||
      callerProfile.approved !== true
    ) {
      return jsonResponse(
        { error: "Only an active, approved Super Admin can generate activation codes." },
        403
      );
    }

    /*
     * ========================================
     * Parse request body
     * ========================================
     */
    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    /*
     * ========================================
     * Administrator ID
     * ========================================
     */
    const adminId = typeof body.admin_id === "string" ? body.admin_id.trim() : "";

    if (!adminId) {
      return jsonResponse({ error: "Administrator ID is required." }, 400);
    }

    if (adminId === caller.id) {
      return jsonResponse(
        { error: "You cannot generate an activation code for your own account." },
        403
      );
    }

    /*
     * ========================================
     * Get target administrator profile
     * ========================================
     */
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("admin_profiles")
      .select("id, full_name, role, status, approved")
      .eq("id", adminId)
      .single();

    if (targetProfileError || !targetProfile) {
      console.error("Target profile error:", targetProfileError);
      return jsonResponse({ error: "Administrator profile not found." }, 404);
    }

    /*
     * ========================================
     * Target must be Pending
     * ========================================
     */
    if (targetProfile.status !== "Pending") {
      return jsonResponse(
        { error: "Activation codes can only be generated for Pending administrator accounts." },
        400
      );
    }

    /*
     * ========================================
     * Get email
     * ========================================
     *
     * admin_profiles has no email column — it only ever lives in
     * auth.users.
     */
    const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(
      adminId
    );

    if (authUserError || !authUserData.user?.email) {
      console.error("Target Auth user lookup error:", authUserError);
      return jsonResponse(
        { error: "Unable to find the administrator's authentication account." },
        404
      );
    }

    const email = authUserData.user.email;

    /*
     * ========================================
     * Invalidate the existing code
     * ========================================
     *
     * At most one unused code should exist per administrator at
     * a time (also enforced by a partial unique index in the
     * database) — deleting the old row is simpler than adding a
     * separate "invalidated" state, and matches this app's
     * general lack of audit-trail columns elsewhere.
     */
    const { error: deleteOldCodeError } = await supabaseAdmin
      .from("admin_activation_codes")
      .delete()
      .eq("admin_id", adminId)
      .is("used_at", null);

    if (deleteOldCodeError) {
      console.error("Delete previous activation code error:", deleteOldCodeError);
      return jsonResponse({ error: "Unable to generate a new activation code." }, 500);
    }

    /*
     * ========================================
     * Generate and store the new code
     * ========================================
     *
     * DO NOT log the raw code.
     */
    const rawCode = generateActivationCode();
    const codeHash = await hashCode(normalizeCode(rawCode));
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS).toISOString();

    const { error: insertCodeError } = await supabaseAdmin
      .from("admin_activation_codes")
      .insert({
        admin_id: adminId,
        code_hash: codeHash,
        expires_at: expiresAt,
        created_by: caller.id,
      });

    if (insertCodeError) {
      console.error("Store activation code error:", insertCodeError);
      return jsonResponse({ error: "Unable to generate a new activation code." }, 500);
    }

    /*
     * ========================================
     * Return the activation code
     * ========================================
     */
    return jsonResponse({
      success: true,
      message: "A new administrator activation code has been generated.",
      activation_code: rawCode,
      expires_at: expiresAt,
      admin: {
        id: targetProfile.id,
        full_name: targetProfile.full_name,
        email,
        role: targetProfile.role,
        status: targetProfile.status,
      },
    });
  } catch (error) {
    /*
     * ========================================
     * Unexpected error
     * ========================================
     */
    console.error("Regenerate admin activation code unexpected error:", error);
    return jsonResponse({ error: "Unexpected server error." }, 500);
  }
});
