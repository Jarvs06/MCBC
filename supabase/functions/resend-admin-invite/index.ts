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
        "Content-Type": "application/json",
      },
    }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed.",
      },
      405
    );
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        {
          error:
            "Server configuration error.",
        },
        500
      );
    }

    const authorization =
      req.headers.get(
        "Authorization"
      );

    if (!authorization) {
      return jsonResponse(
        {
          error:
            "Authorization required.",
        },
        401
      );
    }

    /*
     * Verify the caller's Supabase session.
     */

    const supabaseAuth =
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

    const {
      data: {
        user: caller,
      },
      error: callerAuthError,
    } =
      await supabaseAuth.auth.getUser();

    if (
      callerAuthError ||
      !caller
    ) {
      return jsonResponse(
        {
          error:
            "Unauthorized.",
        },
        401
      );
    }

    /*
     * Service-role client.
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
     * Caller must be an active,
     * approved Super Admin.
     */

    const {
      data: callerProfile,
      error: callerProfileError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .select(
          "id, role, status, approved"
        )
        .eq(
          "id",
          caller.id
        )
        .single();

    if (
      callerProfileError ||
      !callerProfile
    ) {
      return jsonResponse(
        {
          error:
            "Administrator profile not found.",
        },
        403
      );
    }

    if (
      callerProfile.role !==
        "Super Admin" ||
      callerProfile.status !==
        "Active" ||
      callerProfile.approved !==
        true
    ) {
      return jsonResponse(
        {
          error:
            "Only an active, approved Super Admin can generate activation links.",
        },
        403
      );
    }

    /*
     * Parse request body.
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

    const adminId =
      typeof body.admin_id ===
      "string"
        ? body.admin_id.trim()
        : "";

    if (!adminId) {
      return jsonResponse(
        {
          error:
            "Administrator ID is required.",
        },
        400
      );
    }

    if (
      adminId === caller.id
    ) {
      return jsonResponse(
        {
          error:
            "You cannot generate an activation link for your own account.",
        },
        403
      );
    }

    /*
     * Load target admin profile.
     */

    const {
      data: targetProfile,
      error: targetProfileError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .select(
          "id, full_name, role, status, approved"
        )
        .eq(
          "id",
          adminId
        )
        .single();

    if (
      targetProfileError ||
      !targetProfile
    ) {
      return jsonResponse(
        {
          error:
            "Administrator profile not found.",
        },
        404
      );
    }

    /*
     * Only Pending administrators
     * can receive an activation link.
     */

    if (
      targetProfile.status !==
      "Pending"
    ) {
      return jsonResponse(
        {
          error:
            "Activation links can only be generated for Pending administrator accounts.",
        },
        400
      );
    }

    /*
     * Get the Auth user to obtain
     * the email address.
     */

    const {
      data: authUserData,
      error: authUserError,
    } =
      await supabaseAdmin.auth.admin.getUserById(
        adminId
      );

    if (
      authUserError ||
      !authUserData.user
    ) {
      console.error(
        "Target Auth user lookup error:",
        authUserError
      );

      return jsonResponse(
        {
          error:
            "Unable to find the administrator's authentication account.",
        },
        404
      );
    }

    const email =
      authUserData.user.email;

    if (!email) {
      return jsonResponse(
        {
          error:
            "The administrator account does not have an email address.",
        },
        400
      );
    }

    /*
     * Generate a fresh invitation action link.
     *
     * The current church workflow does not
     * use SMTP. generateLink() creates the
     * link; the Super Admin copies and
     * shares it manually.
     */

    const redirectTo =
      "http://localhost:8081/invite";

    const {
      data: inviteData,
      error: inviteError,
    } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo,
        },
      });

    if (
      inviteError ||
      !inviteData?.properties
        ?.action_link
    ) {
      console.error(
        "Generate activation link error:",
        inviteError
      );

      return jsonResponse(
        {
          error:
            "Unable to generate a new activation link.",
        },
        500
      );
    }

    return jsonResponse(
      {
        success: true,

        message:
          "A new administrator activation link has been generated.",

        activation_link:
          inviteData.properties
            .action_link,

        admin: {
          id:
            targetProfile.id,
          full_name:
            targetProfile.full_name,
          email,
          role:
            targetProfile.role,
          status:
            targetProfile.status,
        },
      }
    );
  } catch (error) {
    console.error(
      "Resend admin invite unexpected error:",
      error
    );

    return jsonResponse(
      {
        error:
          "Unexpected server error.",
      },
      500
    );
  }
});
