import { Octokit } from "@octokit/rest";

let cached: Octokit | null = null;

/**
 * Server-only Octokit factory.
 *
 * Reads `GITHUB_TOKEN` from the environment. The token must never reach
 * the client — call this only from server routes or `lib/` functions
 * that themselves run on the server.
 *
 * Throws if the token is missing so misconfiguration fails loudly at
 * boot rather than producing silent unauthenticated requests (which
 * have a much smaller rate-limit budget).
 */
export function getOctokit(): Octokit {
  if (cached) return cached;
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set. Add it to .env.local for local dev or Vercel env vars for deploys.",
    );
  }
  cached = new Octokit({
    auth: token,
    userAgent: "contribution-analyser",
  });
  return cached;
}

/**
 * Reset the cached client. Used by tests that want to swap the token or
 * inject a mock.
 */
export function _resetOctokitForTests(): void {
  cached = null;
}
