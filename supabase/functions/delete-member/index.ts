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
      console.error(
        "[DELETE MEMBER] Missing Supabase environment variables."
      );

      return jsonResponse(
        {
          error:
            "Server configuration error.",
        },
        500
      );
    }

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

    /*
     * ========================================
     * Identify caller
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
        "[DELETE MEMBER] Authentication error:",
        userError
      );

      return jsonResponse(
        {
          error: "Unauthorized.",
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
        serviceRoleKey
      );

    /*
     * ========================================
     * Verify caller is an active Super Admin
     * ========================================
     */

    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from("admin_profiles")
        .select(
          "id, role, status, approved"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error(
        "[DELETE MEMBER] Profile lookup error:",
        profileError
      );

      return jsonResponse(
        {
          error:
            "Unable to verify administrator permissions.",
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
        403
      );
    }

    if (
      profile.role !==
        "Super Admin" ||
      profile.status !==
        "Active" ||
      profile.approved !== true
    ) {
      return jsonResponse(
        {
          error:
            "Only an active approved Super Admin can delete members.",
        },
        403
      );
    }

    /*
     * ========================================
     * Validate request
     * ========================================
     */

    let body: {
      member_id?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          error:
            "Invalid request body.",
        },
        400
      );
    }

    const memberId =
      typeof body.member_id ===
      "string"
        ? body.member_id.trim()
        : "";

    if (!memberId) {
      return jsonResponse(
        {
          error:
            "Member ID is required.",
        },
        400
      );
    }

    /*
     * Basic UUID validation.
     */

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(memberId)) {
      return jsonResponse(
        {
          error:
            "Invalid member ID.",
        },
        400
      );
    }

    /*
     * ========================================
     * Confirm member exists
     * ========================================
     */

    const {
      data: member,
      error: memberError,
    } =
      await supabaseAdmin
        .from("members")
        .select(
          "id, spouse_id"
        )
        .eq("id", memberId)
        .maybeSingle();

    if (memberError) {
      console.error(
        "[DELETE MEMBER] Member lookup error:",
        memberError
      );

      return jsonResponse(
        {
          error:
            "Unable to load the member.",
        },
        500
      );
    }

    if (!member) {
      return jsonResponse(
        {
          error:
            "Member not found.",
        },
        404
      );
    }

    /*
     * ========================================
     * Remove spouse reference
     * ========================================
     *
     * Do this before deleting the member so
     * another member cannot be left pointing
     * to a deleted record.
     */

    const {
      error: spouseUpdateError,
    } =
      await supabaseAdmin
        .from("members")
        .update({
          spouse_id: null,
        })
        .eq(
          "spouse_id",
          memberId
        );

    if (spouseUpdateError) {
      console.error(
        "[DELETE MEMBER] Failed to clear spouse reference:",
        spouseUpdateError
      );

      return jsonResponse(
        {
          error:
            "Unable to update the member's spouse relationship.",
        },
        500
      );
    }

    /*
     * ========================================
     * Delete member
     * ========================================
     */

    const {
      error: deleteError,
    } =
      await supabaseAdmin
        .from("members")
        .delete()
        .eq(
          "id",
          memberId
        );

    if (deleteError) {
      console.error(
        "[DELETE MEMBER] Delete error:",
        deleteError
      );

      /*
       * Attempt to restore the spouse
       * relationship if deletion failed.
       */

      if (
        member.spouse_id
      ) {
        const {
          error:
            restoreError,
        } =
          await supabaseAdmin
            .from("members")
            .update({
              spouse_id:
                memberId,
            })
            .eq(
              "id",
              member.spouse_id
            );

        if (restoreError) {
          console.error(
            "[DELETE MEMBER] Failed to restore spouse relationship:",
            restoreError
          );
        }
      }

      return jsonResponse(
        {
          error:
            "Unable to delete the member.",
        },
        500
      );
    }

    /*
     * ========================================
     * Success
     * ========================================
     */

    return jsonResponse({
      success: true,
      message:
        "Member deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[DELETE MEMBER] Unexpected error:",
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
