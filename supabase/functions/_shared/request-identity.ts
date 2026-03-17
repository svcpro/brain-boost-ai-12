import { createClient } from "npm:@supabase/supabase-js@2";
import { extractApiKey, resolveApiKeyIdentity, type AdminClient } from "./api-key-auth.ts";

const normalizeCredential = (value: string) =>
  value.startsWith("Bearer ") ? value.replace("Bearer ", "").trim() : value.trim();

export const looksLikeJwtToken = (value: string) => {
  const normalized = normalizeCredential(value);
  return normalized.split(".").length === 3;
};

const looksLikeTokenHash = (value: string) => /^[a-f0-9]{16,}$/i.test(normalizeCredential(value));

const getPublicClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

const exchangeTokenHashForSession = async (tokenHash: string) => {
  const publicClient = getPublicClient();
  const { data, error } = await publicClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (error || !data.session?.access_token || !data.user?.id) {
    return null;
  }

  return {
    userId: data.user.id,
    jwtToken: data.session.access_token,
  };
};

export async function resolveIdentityFromSources(
  adminClient: AdminClient,
  authSources: string[],
  apiKeySources: string[],
) {
  const normalizedCandidates = Array.from(
    new Set([...authSources, ...apiKeySources].map(normalizeCredential).filter(Boolean)),
  );
  const jwtCandidates = normalizedCandidates.filter(looksLikeJwtToken);
  const tokenHashCandidates = normalizedCandidates.filter((value) => !looksLikeJwtToken(value) && looksLikeTokenHash(value));

  let userId: string | null = null;
  let jwtToken = "";

  const MAX_RETRIES = 3;

  for (const candidate of jwtCandidates) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: userData, error: userError } = await adminClient.auth.getUser(candidate);
      if (!userError && userData?.user?.id) {
        userId = userData.user.id;
        jwtToken = candidate;
        break;
      }

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }

    if (userId) break;
  }

  if (!userId) {
    for (const candidate of tokenHashCandidates) {
      const exchangedIdentity = await exchangeTokenHashForSession(candidate);
      if (exchangedIdentity?.userId && exchangedIdentity.jwtToken) {
        userId = exchangedIdentity.userId;
        jwtToken = exchangedIdentity.jwtToken;
        break;
      }
    }
  }

  let apiKey = apiKeySources.map(extractApiKey).find(Boolean) || "";

  if (!userId) {
    const apiKeyIdentity = await resolveApiKeyIdentity(adminClient, [...apiKeySources, ...authSources]);
    userId = apiKeyIdentity.userId;
    apiKey = apiKeyIdentity.apiKey || apiKey;
  }

  return {
    userId,
    jwtToken,
    forwardedAuthorization: jwtToken ? `Bearer ${jwtToken}` : "",
    forwardedApiKey: apiKey,
  };
}
