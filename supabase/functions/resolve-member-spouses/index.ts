import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

type SpouseRequest = {
  member_id: string;
  spouse_name: string;
};

type ParsedName = {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
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

function normalizeText(
  value: string | null | undefined
) {
  const text =
    (value ?? "")
      .replace(/\u00a0/g, " ")
      .trim();

  if (
    text.toLowerCase() ===
    "not mentioned"
  ) {
    return "";
  }

  return text;
}

function normalizeNamePart(
  value: string | null | undefined
) {
  return normalizeText(
    value
  ).toLowerCase();
}

function parseName(
  value: string
): ParsedName | null {
  const text =
    normalizeText(value);

  if (!text) {
    return null;
  }

  const parts =
    text
      .split(",")
      .map(
        (part) =>
          normalizeText(part)
      )
      .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const lastName =
    parts[0];

  let givenName =
    parts[1];

  let suffix:
    | string
    | null = null;

  if (parts.length >= 3) {
    suffix =
      parts
        .slice(2)
        .join(", ")
        .trim() || null;
  }

  const givenTokens =
    givenName
      .split(/\s+/)
      .map(
        (part) =>
          normalizeText(part)
      )
      .filter(Boolean);

  let middleName:
    | string
    | null = null;

  /*
   * Example:
   *
   * Atinen, Rens Dielo Q.
   *
   * first_name  = Rens Dielo
   * middle_name = Q.
   */
  if (
    givenTokens.length >= 2
  ) {
    const lastToken =
      givenTokens[
        givenTokens.length - 1
      ];

    if (
      /^[A-Za-z]\.$/.test(
        lastToken
      )
    ) {
      middleName =
        lastToken;

      givenName =
        givenTokens
          .slice(
            0,
            -1
          )
          .join(" ");
    } else {
      givenName =
        givenTokens.join(
          " "
        );
    }
  } else {
    givenName =
      givenTokens.join(
        " "
      );
  }

  if (!givenName) {
    return null;
  }

  return {
    first_name:
      givenName,
    middle_name:
      middleName,
    last_name:
      lastName,
    suffix,
  };
}

async function decryptMember(
  supabaseUrl: string,
  serviceRoleKey: string,
  encrypted: Record<
    string,
    unknown
  >
) {
  const response =
    await fetch(
      `${supabaseUrl}/functions/v1/member-crypto`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${serviceRoleKey}`,
          apikey:
            serviceRoleKey,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          action: "decrypt",
          data: encrypted,
        }),
      }
    );

  if (!response.ok) {
    throw new Error(
      `member-crypto returned HTTP ${response.status}`
    );
  }

  const result =
    await response.json();

  if (
    !result?.success ||
    !result?.data
  ) {
    throw new Error(
      "member-crypto returned an invalid decrypt response."
    );
  }

  return result.data as Record<
    string,
    unknown
  >;
}

Deno.serve(
  async (req: Request) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          error:
            "Method not allowed.",
        },
        405
      );
    }

    try {
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

      if (
        !authorization
      ) {
        return jsonResponse(
          {
            error:
              "Authorization required.",
          },
          401
        );
      }

      /*
       * ======================================
       * Verify authenticated caller
       * ======================================
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
        error:
          userError,
      } =
        await supabaseAuth.auth.getUser();

      if (
        userError ||
        !user
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
       * ======================================
       * Verify Active + Super Admin
       * ======================================
       */

      const supabaseAdmin =
        createClient(
          supabaseUrl,
          serviceRoleKey
        );

      const {
        data: profile,
        error:
          profileError,
      } =
        await supabaseAdmin
          .from(
            "admin_profiles"
          )
          .select(
            "id, role, status, approved"
          )
          .eq(
            "id",
            user.id
          )
          .maybeSingle();

      if (
        profileError
      ) {
        console.error(
          "[RESOLVE SPOUSES] Profile lookup error:",
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

      if (
        !profile ||
        profile.role !==
          "Super Admin" ||
        profile.status !==
          "Active" ||
        profile.approved !==
          true
      ) {
        return jsonResponse(
          {
            error:
              "Only an active approved Super Admin can resolve member spouses.",
          },
          403
        );
      }

      /*
       * ======================================
       * Validate request
       * ======================================
       */

      let body:
        | {
            members?: unknown;
          }
        | null = null;

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

      if (
        !Array.isArray(
          body?.members
        )
      ) {
        return jsonResponse(
          {
            error:
              "members must be an array.",
          },
          400
        );
      }

      const requests =
        body.members.filter(
          (
            item
          ): item is SpouseRequest =>
            !!item &&
            typeof item ===
              "object" &&
            typeof (
              item as SpouseRequest
            ).member_id ===
              "string" &&
            typeof (
              item as SpouseRequest
            ).spouse_name ===
              "string"
        );

      if (
        requests.length ===
        0
      ) {
        return jsonResponse({
          success: true,
          linked: 0,
          unresolved: [],
        });
      }

      /*
       * ======================================
       * Load members
       * ======================================
       *
       * Names are encrypted, so we decrypt them
       * only inside this trusted server-side
       * function for matching.
       */

      const {
        data: members,
        error:
          membersError,
      } =
        await supabaseAdmin
          .from("members")
          .select(
            "id, first_name, middle_name, last_name, suffix"
          );

      if (
        membersError
      ) {
        console.error(
          "[RESOLVE SPOUSES] Member lookup error:",
          membersError
        );

        return jsonResponse(
          {
            error:
              "Unable to load member records.",
          },
          500
        );
      }

      const decryptedMembers:
        Array<{
          id: string;
          first_name: string;
          middle_name:
            | string
            | null;
          last_name: string;
          suffix:
            | string
            | null;
        }> = [];

      for (
        const member of
          members ?? []
      ) {
        try {
          const decrypted =
            await decryptMember(
              supabaseUrl,
              serviceRoleKey,
              {
                first_name:
                  member.first_name,
                middle_name:
                  member.middle_name,
                last_name:
                  member.last_name,
                suffix:
                  member.suffix,
              }
            );

          decryptedMembers.push(
            {
              id:
                member.id,
              first_name:
                String(
                  decrypted.first_name ??
                    ""
                ),
              middle_name:
                decrypted.middle_name
                  ? String(
                      decrypted.middle_name
                    )
                  : null,
              last_name:
                String(
                  decrypted.last_name ??
                    ""
                ),
              suffix:
                decrypted.suffix
                  ? String(
                      decrypted.suffix
                    )
                  : null,
            }
          );
        } catch (error) {
          console.error(
            `[RESOLVE SPOUSES] Failed to decrypt member ${member.id}:`,
            error
          );
        }
      }

      let linked = 0;

      const unresolved:
        Array<{
          member_id: string;
          spouse_name: string;
          reason: string;
        }> = [];

      /*
       * ======================================
       * Resolve each spouse
       * ======================================
       */

      for (
        const request of
          requests
      ) {
        const parsedSpouse =
          parseName(
            request.spouse_name
          );

        if (
          !parsedSpouse
        ) {
          unresolved.push(
            {
              member_id:
                request.member_id,
              spouse_name:
                request.spouse_name,
              reason:
                "Spouse name could not be parsed.",
            }
          );

          continue;
        }

        const exactMatches =
          decryptedMembers.filter(
            (candidate) =>
              candidate.id !==
                request.member_id &&
              normalizeNamePart(
                candidate.first_name
              ) ===
                normalizeNamePart(
                  parsedSpouse.first_name
                ) &&
              normalizeNamePart(
                candidate.middle_name
              ) ===
                normalizeNamePart(
                  parsedSpouse.middle_name
                ) &&
              normalizeNamePart(
                candidate.last_name
              ) ===
                normalizeNamePart(
                  parsedSpouse.last_name
                ) &&
              normalizeNamePart(
                candidate.suffix
              ) ===
                normalizeNamePart(
                  parsedSpouse.suffix
                )
          );

        const fallbackMatches =
          decryptedMembers.filter(
            (candidate) =>
              candidate.id !==
                request.member_id &&
              normalizeNamePart(
                candidate.first_name
              ) ===
                normalizeNamePart(
                  parsedSpouse.first_name
                ) &&
              normalizeNamePart(
                candidate.last_name
              ) ===
                normalizeNamePart(
                  parsedSpouse.last_name
                ) &&
              normalizeNamePart(
                candidate.suffix
              ) ===
                normalizeNamePart(
                  parsedSpouse.suffix
                )
          );

        let spouse:
          | {
              id: string;
            }
          | null = null;

        if (
          exactMatches.length ===
          1
        ) {
          spouse =
            exactMatches[0];
        } else if (
          exactMatches.length ===
          0 &&
          fallbackMatches.length ===
            1
        ) {
          spouse =
            fallbackMatches[0];
        }

        if (
          !spouse
        ) {
          unresolved.push(
            {
              member_id:
                request.member_id,
              spouse_name:
                request.spouse_name,
              reason:
                exactMatches.length >
                    1 ||
                fallbackMatches.length >
                    1
                  ? "Multiple members matched the spouse name."
                  : "No matching member was found.",
            }
          );

          continue;
        }

        /*
         * Link both directions.
         */

        const {
          error:
            firstUpdateError,
        } =
          await supabaseAdmin
            .from("members")
            .update({
              spouse_id:
                spouse.id,
            })
            .eq(
              "id",
              request.member_id
            );

        if (
          firstUpdateError
        ) {
          console.error(
            "[RESOLVE SPOUSES] First spouse update failed:",
            firstUpdateError
          );

          unresolved.push(
            {
              member_id:
                request.member_id,
              spouse_name:
                request.spouse_name,
              reason:
                "Failed to update spouse relationship.",
            }
          );

          continue;
        }

        const {
          error:
            reverseUpdateError,
        } =
          await supabaseAdmin
            .from("members")
            .update({
              spouse_id:
                request.member_id,
            })
            .eq(
              "id",
              spouse.id
            );

        if (
          reverseUpdateError
        ) {
          console.error(
            "[RESOLVE SPOUSES] Reverse spouse update failed:",
            reverseUpdateError
          );

          /*
           * Roll back the first side so we do not
           * leave a one-sided relationship.
           */
          await supabaseAdmin
            .from("members")
            .update({
              spouse_id:
                null,
            })
            .eq(
              "id",
              request.member_id
            );

          unresolved.push(
            {
              member_id:
                request.member_id,
              spouse_name:
                request.spouse_name,
              reason:
                "Failed to complete the two-way spouse relationship.",
            }
          );

          continue;
        }

        linked++;
      }

      return jsonResponse({
        success: true,
        linked,
        unresolved,
      });
    } catch (error) {
      console.error(
        "[RESOLVE SPOUSES] Unexpected error:",
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
  }
);
