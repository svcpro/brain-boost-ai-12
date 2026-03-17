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

  for (const candidate of jwtCandidates) {
    const { data: userData, error: userError } = await adminClient.auth.getUser(candidate);
    if (!userError && userData?.user?.id) {
      userId = userData.user.id;
      jwtToken = candidate;
      break;
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
