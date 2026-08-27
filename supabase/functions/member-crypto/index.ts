import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ENCRYPTION_VERSION = "v1";
const MAX_BATCH_SIZE = 500;

const ENCRYPTED_FIELDS = [
  "first_name",
  "middle_name",
  "last_name",
  "suffix",
  "birth_date",
  "address",
  "contact_no",
];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/*
 * ========================================
 * Base64 helpers
 * ========================================
 */

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }

  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/*
 * ========================================
 * Encryption key
 * ========================================
 */

async function getEncryptionKey() {
  const secret = Deno.env.get("MEMBER_ENCRYPTION_KEY");

  if (!secret) {
    throw new Error("MEMBER_ENCRYPTION_KEY is not configured.");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error("MEMBER_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.");
  }

  const keyBytes = new Uint8Array(32);

  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(secret.slice(i * 2, i * 2 + 2), 16);
  }

  return await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/*
 * ========================================
 * Encrypt one value
 * ========================================
 */

async function encryptValue(value: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));

  return ["enc", ENCRYPTION_VERSION, uint8ArrayToBase64(iv), uint8ArrayToBase64(new Uint8Array(encrypted))].join(
    ":"
  );
}

/*
 * ========================================
 * Decrypt one value
 * ========================================
 */

async function decryptValue(value: string, key: CryptoKey): Promise<string> {
  if (!value.startsWith(`enc:${ENCRYPTION_VERSION}:`)) {
    throw new Error("Unsupported encryption format.");
  }

  const parts = value.split(":");

  if (parts.length !== 4) {
    throw new Error("Invalid encrypted value.");
  }

  const iv = base64ToUint8Array(parts[2]);
  const encrypted = base64ToUint8Array(parts[3]);

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);

  return new TextDecoder().decode(decrypted);
}

/*
 * ========================================
 * Encrypt one member
 * ========================================
 */

async function encryptMember(data: Record<string, unknown>, key: CryptoKey) {
  const result = { ...data };

  for (const field of ENCRYPTED_FIELDS) {
    const value = result[field];

    if (typeof value !== "string" || !value) {
      continue;
    }

    /*
     * Prevent accidental double encryption.
     */
    if (value.startsWith(`enc:${ENCRYPTION_VERSION}:`)) {
      continue;
    }

    result[field] = await encryptValue(value, key);
  }

  return result;
}

/*
 * ========================================
 * Decrypt one member
 * ========================================
 */

async function decryptMember(data: Record<string, unknown>, key: CryptoKey) {
  const result = { ...data };

  for (const field of ENCRYPTED_FIELDS) {
    const value = result[field];

    if (typeof value !== "string" || !value) {
      continue;
    }

    /*
     * Existing plaintext records are returned unchanged.
     * This is temporary migration compatibility.
     */
    if (!value.startsWith(`enc:${ENCRYPTION_VERSION}:`)) {
      continue;
    }

    result[field] = await decryptValue(value, key);
  }

  return result;
}

/*
 * ========================================
 * Encrypt multiple members
 * ========================================
 */

async function encryptMembers(data: Record<string, unknown>[], key: CryptoKey) {
  const result = [];

  for (const member of data) {
    result.push(await encryptMember(member, key));
  }

  return result;
}

/*
 * ========================================
 * Decrypt multiple members
 * ========================================
 */

async function decryptMembers(data: Record<string, unknown>[], key: CryptoKey) {
  const result = [];

  for (const member of data) {
    result.push(await decryptMember(member, key));
  }

  return result;
}

/*
 * ========================================
 * Main Edge Function
 * ========================================
 */

Deno.serve(async (req: Request) => {
  /*
   * ------------------------------------
   * CORS
   * ------------------------------------
   */
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    /*
     * ------------------------------------
     * Environment
     * ------------------------------------
     */
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error." }, 500);
    }

    /*
     * ------------------------------------
     * Authorization
     * ------------------------------------
     */
    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse({ error: "Authorization required." }, 401);
    }

    /*
     * Verify caller's JWT.
     */
    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authorization } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    /*
     * ------------------------------------
     * Service role client
     * ------------------------------------
     */
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    /*
     * ------------------------------------
     * Check admin profile
     * ------------------------------------
     */
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("admin_profiles")
      .select("role, status, approved")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: "Administrator profile not found." }, 403);
    }

    /*
     * ------------------------------------
     * Active + approved admin only
     * ------------------------------------
     */
    if (profile.status !== "Active" || profile.approved !== true) {
      return jsonResponse({ error: "Your administrator account is not active." }, 403);
    }

    /*
     * ------------------------------------
     * Parse request
     * ------------------------------------
     */
    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const action = body.action;

    if (action !== "encrypt" && action !== "decrypt") {
      return jsonResponse({ error: "Invalid action. Use encrypt or decrypt." }, 400);
    }

    /*
     * ------------------------------------
     * Role-based action authorization
     * ------------------------------------
     *
     * Viewer:      can decrypt (read-only access to member data),
     *              matching the frontend's Members screen, which
     *              allows both Super Admin and Viewer to view records.
     * Super Admin: can decrypt AND encrypt.
     *
     * Encryption (i.e. writing/updating member data) remains
     * restricted to Super Admin, since Viewers cannot add, edit,
     * or delete records anywhere else in the app.
     */
    if (action === "encrypt" && profile.role !== "Super Admin") {
      return jsonResponse({ error: "Only Super Admin can encrypt member data." }, 403);
    }

    if (action === "decrypt" && profile.role !== "Super Admin" && profile.role !== "Viewer") {
      return jsonResponse({ error: "You do not have permission to view member data." }, 403);
    }

    const data = body.data;

    if (!data || typeof data !== "object") {
      return jsonResponse({ error: "Invalid data." }, 400);
    }

    /*
     * ------------------------------------
     * Encryption key
     * ------------------------------------
     */
    const key = await getEncryptionKey();

    /*
     * ------------------------------------
     * Handle array
     * ------------------------------------
     */
    if (Array.isArray(data)) {
      /*
       * Prevent excessive batch requests.
       */
      if (data.length > MAX_BATCH_SIZE) {
        return jsonResponse(
          { error: `A maximum of ${MAX_BATCH_SIZE} members can be processed at once.` },
          400
        );
      }

      /*
       * Validate every item.
       */
      for (const item of data) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return jsonResponse({ error: "Invalid member data." }, 400);
        }
      }

      if (action === "encrypt") {
        const encrypted = await encryptMembers(data as Record<string, unknown>[], key);
        return jsonResponse({ success: true, data: encrypted });
      }

      const decrypted = await decryptMembers(data as Record<string, unknown>[], key);
      return jsonResponse({ success: true, data: decrypted });
    }

    /*
     * ------------------------------------
     * Handle single member
     * ------------------------------------
     */
    const member = data as Record<string, unknown>;

    if (action === "encrypt") {
      const encrypted = await encryptMember(member, key);
      return jsonResponse({ success: true, data: encrypted });
    }

    const decrypted = await decryptMember(member, key);
    return jsonResponse({ success: true, data: decrypted });
  } catch (error) {
    console.error("Member crypto error:", error);

    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      500
    );
  }
});