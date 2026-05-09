/**
 * Identity unification — see docs/METRICS.md.
 *
 * Contributors often appear under multiple `(name, email)` pairs because:
 *   - they switch machines / git configs,
 *   - GitHub rewrites their email to the `users.noreply.github.com` form,
 *   - they sign commits with a different name casing.
 *
 * We merge in this order (highest confidence first):
 *   1. GitHub user ID match.
 *   2. Same email (case-insensitive).
 *   3. Same normalised git name (lowercase, whitespace-collapsed).
 *
 * Bots (GitHub Apps like `dependabot[bot]`) are tagged with `isBot: true`
 * and kept as a separate group — caller decides whether to include them
 * in metrics.
 */

const BOT_LOGIN_RE = /\[bot\]$/i;

const KNOWN_BOT_LOGINS = new Set<string>([
  "dependabot",
  "dependabot-preview",
  "github-actions",
  "renovate",
  "renovate-bot",
  "greenkeeper",
  "snyk-bot",
  "imgbot",
  "codecov",
  "deepsource-autofix",
]);

/** A single commit's author signal — what one row of git history tells us. */
export type RawCommitAuthor = {
  /** Stable per-commit key (e.g. commit SHA) — used in the attribution map. */
  key: string;
  /** Free-form git author name (`git log %an`). */
  gitName: string | null;
  /** Free-form git author email (`git log %ae`). */
  gitEmail: string | null;
  /** GitHub login when the API resolved the commit to a user. */
  githubLogin: string | null;
  /** GitHub numeric user ID when the API resolved the commit to a user. */
  githubId: number | null;
  /** GitHub avatar URL when available. */
  githubAvatarUrl: string | null;
};

/** A merged human (or bot) — the unit downstream metrics are computed against. */
export type UnifiedContributor = {
  /** Stable id within this analysis: GitHub login when linked, else a synthetic key. */
  id: string;
  login: string | null;
  displayName: string;
  avatarUrl: string | null;
  emails: string[];
  names: string[];
  githubId: number | null;
  isBot: boolean;
  commitKeys: string[];
};

export type UnificationResult = {
  contributors: UnifiedContributor[];
  /** Map from a `RawCommitAuthor.key` → the contributor id it was merged into. */
  attribution: Map<string, string>;
};

const normName = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const normEmail = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase();

function isBot(input: RawCommitAuthor): boolean {
  if (input.githubLogin && BOT_LOGIN_RE.test(input.githubLogin)) return true;
  if (input.githubLogin && KNOWN_BOT_LOGINS.has(input.githubLogin.toLowerCase())) {
    return true;
  }
  if (input.gitName && BOT_LOGIN_RE.test(input.gitName)) return true;
  return false;
}

/**
 * Merge a stream of commit-author signals into a deduplicated set of
 * contributors. Stable: re-running with the same input produces the same
 * ids in the same order.
 */
export function unifyIdentities(inputs: RawCommitAuthor[]): UnificationResult {
  const contributors: UnifiedContributor[] = [];
  const byGithubId = new Map<number, UnifiedContributor>();
  const byEmail = new Map<string, UnifiedContributor>();
  const byName = new Map<string, UnifiedContributor>();
  const attribution = new Map<string, string>();

  const addAlias = (
    contributor: UnifiedContributor,
    input: RawCommitAuthor,
  ): void => {
    if (input.gitEmail) {
      const e = normEmail(input.gitEmail);
      if (e && !contributor.emails.includes(e)) contributor.emails.push(e);
      if (e) byEmail.set(e, contributor);
    }
    if (input.gitName) {
      const n = normName(input.gitName);
      if (n && !contributor.names.includes(n)) contributor.names.push(n);
      if (n) byName.set(n, contributor);
    }
    if (input.githubId !== null && contributor.githubId === null) {
      contributor.githubId = input.githubId;
      byGithubId.set(input.githubId, contributor);
    }
    if (input.githubLogin && !contributor.login) {
      contributor.login = input.githubLogin;
      contributor.id = input.githubLogin;
      contributor.displayName = input.githubLogin;
    }
    if (input.githubAvatarUrl && !contributor.avatarUrl) {
      contributor.avatarUrl = input.githubAvatarUrl;
    }
    contributor.commitKeys.push(input.key);
    attribution.set(input.key, contributor.id);
  };

  for (const input of inputs) {
    let match: UnifiedContributor | undefined;

    // 1. GitHub user ID — strongest signal.
    if (input.githubId !== null) {
      match = byGithubId.get(input.githubId);
    }

    // 2. Same email.
    if (!match && input.gitEmail) {
      match = byEmail.get(normEmail(input.gitEmail));
    }

    // 3. Same normalised name (last resort — collisions are possible
    //    on common names, but METRICS.md accepts that trade-off for MVP).
    if (!match && input.gitName) {
      match = byName.get(normName(input.gitName));
    }

    if (match) {
      addAlias(match, input);
      continue;
    }

    const bot = isBot(input);
    const idSeed =
      input.githubLogin ??
      (input.gitEmail ? `email:${normEmail(input.gitEmail)}` : null) ??
      (input.gitName ? `name:${normName(input.gitName)}` : null) ??
      `unknown:${input.key}`;

    const fresh: UnifiedContributor = {
      id: idSeed,
      login: input.githubLogin,
      displayName: input.githubLogin ?? input.gitName ?? "Unknown contributor",
      avatarUrl: input.githubAvatarUrl,
      emails: [],
      names: [],
      githubId: null,
      isBot: bot,
      commitKeys: [],
    };
    contributors.push(fresh);
    addAlias(fresh, input);
  }

  return { contributors, attribution };
}
