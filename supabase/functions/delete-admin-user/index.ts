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
      { error: "Method not allowed." },
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

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Server configuration error." },
        500
      );
    }

    const authorization =
      req.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(
        { error: "Authorization required." },
        401
      );
    }

    const supabaseAuth =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          global: {
            headers: {
              Authorization: authorization,
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
      data: { user: caller },
      error: callerAuthError,
    } =
      await supabaseAuth.auth.getUser();

    if (callerAuthError || !caller) {
      return jsonResponse(
        { error: "Unauthorized." },
        401
      );
    }

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
     * Caller must be an active, approved
     * Super Admin.
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
        .eq("id", caller.id)
        .single();

    if (callerProfileError || !callerProfile) {
      return jsonResponse(
        {
          error:
            "Administrator profile not found.",
        },
        403
      );
    }

    if (
      callerProfile.role !== "Super Admin" ||
      callerProfile.status !== "Active" ||
      callerProfile.approved !== true
    ) {
      return jsonResponse(
        {
          error:
            "Only an active, approved Super Admin can delete administrator accounts.",
        },
        403
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid request body." },
        400
      );
    }

    const adminId =
      typeof body.admin_id === "string"
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

    if (adminId === caller.id) {
      return jsonResponse(
        {
          error:
            "You cannot delete your own administrator account.",
        },
        403
      );
    }

    /*
     * Load target profile.
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
        .eq("id", adminId)
        .single();

    if (targetProfileError || !targetProfile) {
      return jsonResponse(
        {
          error:
            "Administrator profile not found.",
        },
        404
      );
    }

    /*
     * For safety, do not allow this operation
     * to delete another Super Admin.
     *
     * Super Admin deletion can be added later
     * as a separate, more deliberate workflow.
     */
    if (targetProfile.role === "Super Admin") {
      return jsonResponse(
        {
          error:
            "Super Admin accounts cannot be deleted through this operation.",
        },
        403
      );
    }

    /*
     * Delete the Auth account.
     *
     * If admin_profiles has ON DELETE CASCADE,
     * its profile is removed automatically.
     */
    const {
      error: authDeleteError,
    } =
      await supabaseAdmin.auth.admin.deleteUser(
        adminId
      );

    if (authDeleteError) {
      console.error(
        "Auth user deletion error:",
        authDeleteError
      );

      return jsonResponse(
        {
          error:
            "Unable to delete the administrator authentication account.",
        },
        500
      );
    }

    /*
     * Explicitly remove the profile as well.
     * If a cascade already removed it, this
     * DELETE simply affects zero rows.
     */
    const {
      error: profileDeleteError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .delete()
        .eq("id", adminId);

    if (profileDeleteError) {
      console.error(
        "Admin profile deletion error:",
        profileDeleteError
      );

      return jsonResponse(
        {
          error:
            "The authentication account was deleted, but the administrator profile could not be removed. Please check the admin_profiles table.",
        },
        500
      );
    }

    return jsonResponse(
      {
        success: true,
        message:
          "Administrator account deleted successfully.",
        deleted_admin: {
          id: targetProfile.id,
          full_name:
            targetProfile.full_name,
        },
      }
    );
  } catch (error) {
    console.error(
      "Delete admin user unexpected error:",
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
