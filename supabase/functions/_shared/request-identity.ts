import { extractApiKey, resolveApiKeyIdentity, type AdminClient } from "./api-key-auth.ts";

const normalizeCredential = (value: string) =>
  value.startsWith("Bearer ") ? value.replace("Bearer ", "").trim() : value.trim();

export const looksLikeJwtToken = (value: string) => {
  const normalized = normalizeCredential(value);
  return normalized.split(".").length === 3;
};

export async function resolveIdentityFromSources(
  adminClient: AdminClient,
  authSources: string[],
  apiKeySources: string[],
) {
  const jwtCandidates = Array.from(
    new Set(
      [...authSources, ...apiKeySources]
        .map(normalizeCredential)
        .filter(Boolean)
        .filter(looksLikeJwtToken),
    ),
  );

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
