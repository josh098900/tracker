import { z } from "zod";

/**
 * Strict GitHub URL pattern.
 *
 * Matches `http(s)://github.com/<owner>/<repo>` with an optional trailing
 * slash, optional `.git` suffix, and rejects anything with extra path
 * segments (e.g. `/owner/repo/tree/main`). Owner and repo follow GitHub's
 * own character rules: `[\w.-]` (word char, dot, or hyphen).
 */
const GITHUB_URL_RE =
  /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i;

export const githubUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .regex(GITHUB_URL_RE, "Must be a public GitHub repo URL");

export type ParsedRepo = {
  owner: string;
  repo: string;
};

/**
 * Parse a GitHub repo URL into its `{ owner, repo }` parts.
 *
 * Throws on invalid input (caller should `try/catch` or validate the
 * URL with `githubUrlSchema` first). Trailing `.git` and trailing
 * slashes are stripped. URLs with extra path segments — issues, PRs,
 * tree views — are rejected so we never accidentally analyse a sub-path.
 */
export function parseGithubUrl(url: string): ParsedRepo {
  const trimmed = url.trim();
  const match = GITHUB_URL_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Not a valid GitHub repo URL: ${url}`);
  }
  const [, owner, repo] = match;
  return { owner, repo };
}
