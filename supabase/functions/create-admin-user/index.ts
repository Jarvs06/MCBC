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
     * We generate the invitation link below.
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
     * a separate step.
     *
     * We intentionally do not set:
     *
     * status = "Active"
     *
     * here.
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
     * Generate invitation link
     * ========================================
     *
     * IMPORTANT:
     *
     * generateLink() creates the action
     * link but does NOT send an email.
     *
     * This allows your church to operate
     * without an external SMTP provider.
     */

    const {
      data: inviteData,
      error:
        inviteError,
    } =
      await supabaseAdmin.auth.admin.generateLink(
        {
          type: "invite",
          email,
        }
      );

    /*
     * ========================================
     * Roll back everything if the invite
     * link cannot be generated
     * ========================================
     */

    if (
      inviteError ||
      !inviteData?.properties
        ?.action_link
    ) {
      console.error(
        "Generate invitation link error:",
        inviteError
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
            "Failed to generate administrator activation link.",
        },
        500
      );
    }

    const activationLink =
      inviteData.properties
        .action_link;

    /*
     * ========================================
     * Success
     * ========================================
     *
     * The activation link is returned to
     * the authenticated Super Admin.
     *
     * DO NOT log the link.
     */

    return jsonResponse(
      {
        success: true,

        message:
          "User successfully registered. Activation link generated.",

        user: {
          id: newUserId,
          email,
          full_name:
            fullName,
          role,
          approved: true,
        },

        activation_link:
          activationLink,
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