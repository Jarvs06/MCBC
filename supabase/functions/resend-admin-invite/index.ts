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
 * Allowed origins -> invite path
 * ========================================
 * Centralizing this makes it easy to see (and keep in sync with)
 * Supabase's Auth "Redirect URLs" allow-list, which MUST contain
 * the exact resulting `${origin}${path}` value for each entry below,
 * or generateLink() will silently fall back to your project's Site URL.
 */
const ALLOWED_ORIGINS: Record<string, string> = {
  "https://jarvs06.github.io": "/MCBC/invite",
  "http://localhost:3000": "/invite",
  "http://localhost:8081": "/invite",
  "http://localhost:8082": "/invite",
  "http://localhost:19006": "/invite",
};

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    // new URL(...).origin strips any trailing slash, path, query, etc.
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function resolveRedirectTo(req: Request): { redirectTo: string | null; origin: string; referer: string } {
  const rawOrigin = req.headers.get("Origin")?.trim() || "";
  const rawReferer = req.headers.get("Referer")?.trim() || "";

  // Prefer Origin (always sent by browsers on cross-origin fetch/XHR).
  const originCandidate = normalizeOrigin(rawOrigin);
  if (originCandidate && ALLOWED_ORIGINS[originCandidate]) {
    return {
      redirectTo: `${originCandidate}${ALLOWED_ORIGINS[originCandidate]}`,
      origin: rawOrigin,
      referer: rawReferer,
    };
  }

  // Fall back to Referer's origin (covers cases where Origin is stripped,
  // e.g. some same-origin or navigation requests).
  const refererCandidate = normalizeOrigin(rawReferer);
  if (refererCandidate && ALLOWED_ORIGINS[refererCandidate]) {
    return {
      redirectTo: `${refererCandidate}${ALLOWED_ORIGINS[refererCandidate]}`,
      origin: rawOrigin,
      referer: rawReferer,
    };
  }

  return { redirectTo: null, origin: rawOrigin, referer: rawReferer };
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
     * Determine activation redirect URL
     * ========================================
     */
    const { redirectTo, origin, referer } = resolveRedirectTo(req);

    console.log("Activation Origin:", origin);
    console.log("Activation Referer:", referer);
    console.log("Activation Redirect:", redirectTo);

    if (!redirectTo) {
      console.error("Invalid activation origin:", { origin, referer });
      return jsonResponse({ error: "Invalid activation redirect origin." }, 400);
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
        { error: "Only an active, approved Super Admin can generate activation links." },
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
        { error: "You cannot generate an activation link for your own account." },
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
        { error: "Activation links can only be generated for Pending administrator accounts." },
        400
      );
    }

    /*
     * ========================================
     * Get Auth user
     * ========================================
     */
    const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(
      adminId
    );

    if (authUserError || !authUserData.user) {
      console.error("Target Auth user lookup error:", authUserError);
      return jsonResponse(
        { error: "Unable to find the administrator's authentication account." },
        404
      );
    }

    /*
     * ========================================
     * Get email
     * ========================================
     */
    const email = authUserData.user.email;

    if (!email) {
      return jsonResponse(
        { error: "The administrator account does not have an email address." },
        400
      );
    }

    /*
     * ========================================
     * Generate invitation link
     * ========================================
     */
    console.log("Generating activation link for:", email);
    console.log("Using redirect URL:", redirectTo);

    let inviteData: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.generateLink>>["data"];
    let inviteError: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.generateLink>>["error"];

    const firstAttempt = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    inviteData = firstAttempt.data;
    inviteError = firstAttempt.error;

    /*
     * "invite" only works for auth users that don't already exist.
     * The target's auth account was already created by the *original*
     * invite, so regenerating/resending hits AuthApiError
     * (status 422, code "email_exists"). In that case, fall back to a
     * "recovery" link, which is valid for an existing-but-unconfirmed
     * user and still honors the same redirectTo.
     */
    if (inviteError && (inviteError as { code?: string }).code === "email_exists") {
      console.log(
        "Invite link failed with email_exists; falling back to recovery link for:",
        email
      );

      const fallbackAttempt = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });

      inviteData = fallbackAttempt.data;
      inviteError = fallbackAttempt.error;
    }

    if (inviteError || !inviteData?.properties?.action_link) {
      console.error("Generate activation link error:", inviteError);
      return jsonResponse({ error: "Unable to generate a new activation link." }, 500);
    }

    /*
     * ========================================
     * Return activation link
     * ========================================
     */
    return jsonResponse({
      success: true,
      message: "A new administrator activation link has been generated.",
      activation_link: inviteData.properties.action_link,
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
    console.error("Resend admin invite unexpected error:", error);
    return jsonResponse({ error: "Unexpected server error." }, 500);
  }
});