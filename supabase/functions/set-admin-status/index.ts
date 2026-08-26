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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
      data: { user },
      error: userError,
    } =
      await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error(
        "Get authenticated user error:",
        userError
      );

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
      error: callerError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .select("id, role, status, approved")
        .eq("id", user.id)
        .single();

    if (callerError || !callerProfile) {
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
            "Only an active, approved Super Admin can change administrator status.",
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

    const requestedStatus =
      body.status;

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
      requestedStatus !== "Active" &&
      requestedStatus !== "Disabled"
    ) {
      return jsonResponse(
        {
          error:
            "Status must be Active or Disabled.",
        },
        400
      );
    }

    const status =
      requestedStatus as
        | "Active"
        | "Disabled";

    /*
     * Never allow a Super Admin to
     * disable their own account.
     */
    if (
      adminId === user.id &&
      status === "Disabled"
    ) {
      return jsonResponse(
        {
          error:
            "You cannot disable your own administrator account.",
        },
        403
      );
    }

    const {
      data: targetProfile,
      error: targetError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .select(
          "id, full_name, role, status, approved"
        )
        .eq("id", adminId)
        .single();

    if (targetError || !targetProfile) {
      return jsonResponse(
        {
          error:
            "Administrator profile not found.",
        },
        404
      );
    }

    /*
     * Pending accounts must use the existing
     * invitation activation flow. This function
     * cannot turn Pending into Active.
     */
    if (
      targetProfile.status === "Pending" &&
      status === "Active"
    ) {
      return jsonResponse(
        {
          error:
            "Pending administrator accounts must complete the invitation activation flow before becoming Active.",
        },
        400
      );
    }

    const {
      data: updatedProfile,
      error: updateError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .update({
          status,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", adminId)
        .select(
          "id, full_name, role, status, approved, created_at, updated_at"
        )
        .single();

    if (updateError) {
      console.error(
        "Admin status update error:",
        updateError
      );

      return jsonResponse(
        {
          error:
            "Unable to update administrator status.",
        },
        500
      );
    }

    return jsonResponse(
      {
        success: true,
        message:
          `Administrator account ${status.toLowerCase()} successfully.`,
        profile: updatedProfile,
      }
    );
  } catch (error) {
    console.error(
      "Set admin status unexpected error:",
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
