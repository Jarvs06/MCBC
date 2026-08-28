import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

/*
 * Kept in sync with src/lib/validators.ts (MIN_PASSWORD_LENGTH).
 * Edge functions can't import from the app bundle, so this is
 * duplicated the same way the rest of this file's rules are.
 */
const MIN_PASSWORD_LENGTH = 8;

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
            "Only an active, approved Super Admin can set an administrator's password.",
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

    const password =
      typeof body.password === "string"
        ? body.password
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

    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonResponse(
        {
          error:
            `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        },
        400
      );
    }

    /*
     * A Super Admin's own password isn't managed
     * through this operation.
     */
    if (adminId === caller.id) {
      return jsonResponse(
        {
          error:
            "You cannot set your own password through this operation.",
        },
        403
      );
    }

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
     * For safety, a Super Admin's password
     * cannot be set through this operation.
     */
    if (targetProfile.role === "Super Admin") {
      return jsonResponse(
        {
          error:
            "A Super Admin's password cannot be set through this operation.",
        },
        403
      );
    }

    /*
     * ========================================
     * Set the password
     * ========================================
     *
     * `email_confirm: true` is also set here because a normal
     * invite confirms the email as part of accepting it — an
     * account whose password was set this way instead should
     * still be able to sign in immediately afterward.
     */
    const {
      error: updatePasswordError,
    } =
      await supabaseAdmin.auth.admin.updateUserById(
        adminId,
        {
          password,
          email_confirm: true,
        }
      );

    if (updatePasswordError) {
      console.error(
        "Set admin password error:",
        updatePasswordError
      );

      return jsonResponse(
        {
          error:
            "Unable to set the administrator's password.",
        },
        500
      );
    }

    /*
     * A Pending account that never completed the
     * invitation flow becomes Active now that it has
     * a password. Active/Disabled accounts keep their
     * existing status — this never re-enables a
     * Disabled account.
     */
    let updatedStatus = targetProfile.status;

    if (targetProfile.status === "Pending") {
      const {
        error: statusUpdateError,
      } =
        await supabaseAdmin
          .from("admin_profiles")
          .update({
            status: "Active",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", adminId);

      if (statusUpdateError) {
        console.error(
          "Activate profile after password set error:",
          statusUpdateError
        );

        return jsonResponse(
          {
            error:
              "The password was set, but the administrator profile could not be activated. Please check the admin_profiles table.",
          },
          500
        );
      }

      updatedStatus = "Active";
    }

    return jsonResponse(
      {
        success: true,
        message:
          "Administrator password set successfully.",
        admin: {
          id: targetProfile.id,
          full_name:
            targetProfile.full_name,
          role: targetProfile.role,
          status: updatedStatus,
        },
      }
    );
  } catch (error) {
    console.error(
      "Set admin password unexpected error:",
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
