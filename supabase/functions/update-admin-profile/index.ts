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

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed.",
      },
      405
    );
  }

  try {
    /*
     * ========================================
     * Environment
     * ========================================
     */

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
     * Authorization
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
            "Authorization required.",
        },
        401
      );
    }

    /*
     * ========================================
     * Verify authenticated user
     * ========================================
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
        user,
      },
      error: userError,
    } =
      await supabaseAuth.auth.getUser();

    if (
      userError ||
      !user
    ) {
      console.error(
        "Get authenticated user error:",
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
     * Service-role client
     * ========================================
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
     * Verify caller is an active Super Admin
     * ========================================
     */

    const {
      data: callerProfile,
      error: callerError,
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
      callerError ||
      !callerProfile
    ) {
      console.error(
        "Caller profile lookup error:",
        callerError
      );

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
      "Super Admin"
    ) {
      return jsonResponse(
        {
          error:
            "Only Super Admin can update administrator accounts.",
        },
        403
      );
    }

    if (
      callerProfile.status !==
      "Active"
    ) {
      return jsonResponse(
        {
          error:
            "Your administrator account is not active.",
        },
        403
      );
    }

    if (
      callerProfile.approved !==
      true
    ) {
      return jsonResponse(
        {
          error:
            "Your administrator account is not approved.",
        },
        403
      );
    }

    /*
     * ========================================
     * Request body
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

    const adminId =
      typeof body.admin_id ===
      "string"
        ? body.admin_id.trim()
        : "";

    const fullName =
      typeof body.full_name ===
      "string"
        ? body.full_name.trim()
        : "";

    const requestedRole =
      body.role;

    /*
     * ========================================
     * Validate admin ID
     * ========================================
     */

    if (!adminId) {
      return jsonResponse(
        {
          error:
            "Administrator ID is required.",
        },
        400
      );
    }

    /*
     * ========================================
     * Validate full name
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

    if (
      fullName.length >
      150
    ) {
      return jsonResponse(
        {
          error:
            "Full name cannot exceed 150 characters.",
        },
        400
      );
    }

    /*
     * ========================================
     * Validate role
     * ========================================
     */

    if (
      requestedRole !==
        "Viewer" &&
      requestedRole !==
        "Super Admin"
    ) {
      return jsonResponse(
        {
          error:
            "Invalid administrator role.",
        },
        400
      );
    }

    const role =
      requestedRole as
        | "Viewer"
        | "Super Admin";

    /*
     * ========================================
     * Load target administrator
     * ========================================
     */

    const {
      data: targetProfile,
      error: targetError,
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
      targetError ||
      !targetProfile
    ) {
      console.error(
        "Target profile lookup error:",
        targetError
      );

      return jsonResponse(
        {
          error:
            "Administrator profile not found.",
        },
        404
      );
    }

    /*
     * ========================================
     * Prevent self-role changes
     * ========================================
     *
     * A Super Admin can update their own
     * name, but cannot use this function
     * to change their own role.
     */

    if (
      adminId === user.id &&
      role !==
        targetProfile.role
    ) {
      return jsonResponse(
        {
          error:
            "You cannot change your own administrator role.",
        },
        403
      );
    }

    /*
     * ========================================
     * Update profile
     * ========================================
     *
     * We intentionally do NOT accept:
     *
     * status
     * approved
     *
     * from the client.
     *
     * Those are separate account-management
     * operations.
     */

    const {
      data: updatedProfile,
      error: updateError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .update({
          full_name:
            fullName,

          role,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          adminId
        )
        .select(
          "id, full_name, role, status, approved, created_at, updated_at"
        )
        .single();

    if (updateError) {
      console.error(
        "Update admin profile error:",
        updateError
      );

      return jsonResponse(
        {
          error:
            "Unable to update administrator profile.",
        },
        500
      );
    }

    /*
     * ========================================
     * Success
     * ========================================
     */

    return jsonResponse(
      {
        success: true,

        message:
          "Administrator profile updated successfully.",

        profile:
          updatedProfile,
      }
    );
  } catch (error) {
    console.error(
      "Update admin profile unexpected error:",
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
