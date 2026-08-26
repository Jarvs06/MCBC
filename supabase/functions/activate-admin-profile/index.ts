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
  // ----------------------------------------
  // CORS
  // ----------------------------------------

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
    // ----------------------------------------
    // Environment
    // ----------------------------------------

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

    // ----------------------------------------
    // Authorization
    // ----------------------------------------

    const authorization =
      req.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(
        {
          error:
            "Authorization required.",
        },
        401
      );
    }

    // ----------------------------------------
    // Identify authenticated user
    // ----------------------------------------

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
        }
      );

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error(
        "Get authenticated user error:",
        userError
      );

      return jsonResponse(
        {
          error: "Unauthorized.",
        },
        401
      );
    }

    // ----------------------------------------
    // Service-role client
    // ----------------------------------------

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey
      );

    // ----------------------------------------
    // Find user's admin profile
    // ----------------------------------------

    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .select(
          "id, full_name, role, status, approved"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error(
        "Profile lookup error:",
        profileError
      );

      return jsonResponse(
        {
          error:
            "Unable to load administrator profile.",
        },
        500
      );
    }

    if (!profile) {
      return jsonResponse(
        {
          error:
            "Administrator profile not found.",
        },
        404
      );
    }

    // ----------------------------------------
    // Make sure this is a pending account
    // ----------------------------------------

    if (
      profile.status === "Active" &&
      profile.approved === true
    ) {
      return jsonResponse(
        {
          success: true,
          message:
            "Administrator account is already active.",
          profile,
        }
      );
    }

    // ----------------------------------------
    // Activate ONLY this user's profile
    // ----------------------------------------

    const {
      data: updatedProfile,
      error: updateError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .update({
          status: "Active",
          approved: true,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", user.id)
        .select(
          "id, full_name, role, status, approved"
        )
        .single();

    if (updateError) {
      console.error(
        "Profile activation error:",
        updateError
      );

      return jsonResponse(
        {
          error:
            "Unable to activate administrator profile.",
        },
        500
      );
    }

    // ----------------------------------------
    // Success
    // ----------------------------------------

    return jsonResponse(
      {
        success: true,
        message:
          "Administrator account activated successfully.",
        profile: updatedProfile,
      }
    );
  } catch (error) {
    console.error(
      "Activate admin profile error:",
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