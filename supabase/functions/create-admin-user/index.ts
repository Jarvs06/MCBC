import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    }
  );
}

/*
 * ========================================
 * Activation code
 * ========================================
 *
 * Kept in sync with regenerate-admin-activation-code, which
 * generates a replacement code the same way later.
 *
 * Codes are never stored raw — only a SHA-256 hash. The raw code
 * is returned to the calling Super Admin exactly once, in this
 * function's response, and must never be logged.
 *
 * Alphabet excludes visually ambiguous characters (0/O, 1/I/L) and
 * has exactly 32 symbols so `byte % 32` has no modulo bias.
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
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  /*
   * ========================================
   * Only allow POST
   * ========================================
   */

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error:
          "Method not allowed.",
      },
      405
    );
  }

  try {
    /*
     * ========================================
     * Supabase environment
     * ========================================
     */

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error(
        "Missing Supabase environment variables."
      );

      return jsonResponse(
        {
          error:
            "Server configuration error.",
        },
        500
      );
    }

    /*
     * ========================================
     * Get Authorization header
     * ========================================
     */

    const authorization =
      req.headers.get(
        "Authorization"
      );

    if (!authorization) {
      return jsonResponse(
        {
          error:
            "Authorization is required.",
        },
        401
      );
    }

    /*
     * ========================================
     * Client representing current user
     * ========================================
     *
     * The service role key remains inside
     * the Edge Function.
     */

    const supabaseUser =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        }
      );

    /*
     * ========================================
     * Verify current user
     * ========================================
     */

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabaseUser.auth.getUser();

    if (
      userError ||
      !user
    ) {
      console.error(
        "Authentication error:",
        userError
      );

      return jsonResponse(
        {
          error:
            "Unauthorized.",
        },
        401
      );
    }

    /*
     * ========================================
     * Admin client
     * ========================================
     *
     * This client bypasses RLS.
     *
     * It NEVER leaves this Edge Function.
     */

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        }
      );

    /*
     * ========================================
     * Check current admin profile
     * ========================================
     */

    const {
      data: adminProfile,
      error: profileError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .select(
          "id, role, status, approved"
        )
        .eq(
          "id",
          user.id
        )
        .single();

    if (
      profileError ||
      !adminProfile
    ) {
      console.error(
        "Admin profile error:",
        profileError
      );

      return jsonResponse(
        {
          error:
            "Administrator profile not found.",
        },
        403
      );
    }

    /*
     * ========================================
     * Super Admin only
     * ========================================
     */

    if (
      adminProfile.role !==
      "Super Admin"
    ) {
      return jsonResponse(
        {
          error:
            "Only Super Admin can register users.",
        },
        403
      );
    }

    /*
     * ========================================
     * Must be approved
     * ========================================
     */

    if (
      adminProfile.approved !==
      true
    ) {
      return jsonResponse(
        {
          error:
            "Your account is not approved.",
        },
        403
      );
    }

    /*
     * ========================================
     * Must be active
     * ========================================
     *
     * This adds an additional layer of
     * protection.
     */

    if (
      adminProfile.status !==
      "Active"
    ) {
      return jsonResponse(
        {
          error:
            "Your account is not active.",
        },
        403
      );
    }

    /*
     * ========================================
     * Read request body
     * ========================================
     */

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        await req.json();
    } catch {
      return jsonResponse(
        {
          error:
            "Invalid request body.",
        },
        400
      );
    }

    /*
     * ========================================
     * Full name
     * ========================================
     */

    const fullName =
      typeof body.full_name ===
      "string"
        ? body.full_name.trim()
        : "";

    /*
     * ========================================
     * Email
     * ========================================
     */

    const email =
      typeof body.email ===
      "string"
        ? body.email
            .trim()
            .toLowerCase()
        : "";

    /*
     * ========================================
     * Validate name
     * ========================================
     */

    if (!fullName) {
      return jsonResponse(
        {
          error:
            "Full name is required.",
        },
        400
      );
    }

    /*
     * Prevent excessively large names.
     */

    if (
      fullName.length >
      150
    ) {
      return jsonResponse(
        {
          error:
            "Full name is too long.",
        },
        400
      );
    }

    /*
     * ========================================
     * Validate email
     * ========================================
     */

    if (!email) {
      return jsonResponse(
        {
          error:
            "Email address is required.",
        },
        400
      );
    }

    if (
      email.length >
      254
    ) {
      return jsonResponse(
        {
          error:
            "Email address is too long.",
        },
        400
      );
    }

    const emailIsValid =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      );

    if (!emailIsValid) {
      return jsonResponse(
        {
          error:
            "Please provide a valid email address.",
        },
        400
      );
    }

    /*
     * ========================================
     * IMPORTANT
     * ========================================
     *
     * Every newly created administrator
     * starts as Viewer.
     *
     * The client cannot choose the role.
     */

    const role =
      "Viewer";

    /*
     * ========================================
     * Create Auth user
     * ========================================
     *
     * We deliberately do NOT send an email
     * here.
     *
     * createUser() does not send confirmation
     * emails.
     *
     * We generate an activation code below
     * instead.
     */

    const {
      data: createdUser,
      error:
        createUserError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email,
          email_confirm: false,

          user_metadata: {
            full_name:
              fullName,
          },
        }
      );

    if (
      createUserError ||
      !createdUser.user
    ) {
      console.error(
        "Create Auth user error:",
        createUserError
      );

      return jsonResponse(
        {
          error:
            createUserError?.message ??
            "Failed to create user.",
        },
        400
      );
    }

    const newUserId =
      createdUser.user.id;

    /*
     * ========================================
     * Create admin profile
     * ========================================
     *
     * The account is approved by the
     * Super Admin, but activation remains
     * a separate step: the invited user must
     * still set their own password (or a Super
     * Admin sets one via set-admin-password)
     * before this becomes "Active".
     *
     * status is set explicitly here rather than
     * left to the admin_profiles table's column
     * default, which is "Active" — relying on
     * that default previously created accounts
     * that were fully activated before anyone had
     * set a password.
     */

    const {
      error:
        insertProfileError,
    } =
      await supabaseAdmin
        .from(
          "admin_profiles"
        )
        .insert({
          id: newUserId,
          full_name:
            fullName,
          role,
          approved: true,
          status: "Pending",
        });

    /*
     * ========================================
     * Roll back Auth account if profile
     * creation fails
     * ========================================
     */

    if (
      insertProfileError
    ) {
      console.error(
        "Admin profile creation error:",
        insertProfileError
      );

      await supabaseAdmin.auth.admin.deleteUser(
        newUserId
      );

      return jsonResponse(
        {
          error:
            "Failed to create administrator profile.",
        },
        500
      );
    }

    /*
     * ========================================
     * Generate activation code
     * ========================================
     *
     * Replaces the old emailed/copied invitation link. The raw
     * code is only ever held in memory here and in the response
     * below — the database only ever sees its SHA-256 hash.
     */

    const rawCode =
      generateActivationCode();

    const normalizedCode =
      normalizeCode(rawCode);

    const codeHash =
      await hashCode(
        normalizedCode
      );

    const expiresAt =
      new Date(
        Date.now() +
          CODE_EXPIRY_MS
      ).toISOString();

    const {
      error:
        insertCodeError,
    } =
      await supabaseAdmin
        .from(
          "admin_activation_codes"
        )
        .insert({
          admin_id: newUserId,
          code_hash: codeHash,
          expires_at: expiresAt,
          created_by: user.id,
        });

    /*
     * ========================================
     * Roll back everything if the code
     * cannot be stored
     * ========================================
     */

    if (
      insertCodeError
    ) {
      console.error(
        "Store activation code error:",
        insertCodeError
      );

      /*
       * Remove admin profile first.
       */

      await supabaseAdmin
        .from(
          "admin_profiles"
        )
        .delete()
        .eq(
          "id",
          newUserId
        );

      /*
       * Remove Auth user.
       */

      await supabaseAdmin.auth.admin.deleteUser(
        newUserId
      );

      return jsonResponse(
        {
          error:
            "Failed to generate an administrator activation code.",
        },
        500
      );
    }

    /*
     * ========================================
     * Success
     * ========================================
     *
     * The raw activation code is returned to
     * the authenticated Super Admin exactly
     * once — it cannot be retrieved again.
     *
     * DO NOT log the code.
     */

    return jsonResponse(
      {
        success: true,

        message:
          "User successfully registered. Activation code generated.",

        user: {
          id: newUserId,
          email,
          full_name:
            fullName,
          role,
          approved: true,
        },

        activation_code:
          rawCode,

        expires_at:
          expiresAt,
      },
      201
    );
  } catch (error) {
    /*
     * ========================================
     * Unexpected error
     * ========================================
     */

    console.error(
      "Unexpected error:",
      error
    );

    return jsonResponse(
      {
        error:
          "An unexpected server error occurred.",
      },
      500
    );
  }
});