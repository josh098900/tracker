import { describe, expect, it } from "vitest";
import {
  unifyIdentities,
  type RawCommitAuthor,
} from "../identityUnification";

const c = (
  key: string,
  overrides: Partial<RawCommitAuthor> = {},
): RawCommitAuthor => ({
  key,
  gitName: null,
  gitEmail: null,
  githubLogin: null,
  githubId: null,
  githubAvatarUrl: null,
  ...overrides,
});

describe("unifyIdentities — single contributor", () => {
  it("returns one contributor for a single-author repo", () => {
    const res = unifyIdentities([
      c("a1", { gitName: "Sam", gitEmail: "sam@uni.ac.uk", githubLogin: "samdev", githubId: 1 }),
      c("a2", { gitName: "Sam", gitEmail: "sam@uni.ac.uk", githubLogin: "samdev", githubId: 1 }),
    ]);
    expect(res.contributors).toHaveLength(1);
    expect(res.contributors[0].login).toBe("samdev");
    expect(res.contributors[0].commitKeys).toEqual(["a1", "a2"]);
  });
});

describe("unifyIdentities — same email merge", () => {
  it("merges commits sharing an email despite name differences", () => {
    const res = unifyIdentities([
      c("a1", { gitName: "Josh Smith", gitEmail: "josh@uni.ac.uk" }),
      c("a2", { gitName: "josh-smith", gitEmail: "JOSH@uni.ac.uk" }),
    ]);
    expect(res.contributors).toHaveLength(1);
    expect(res.contributors[0].emails).toEqual(["josh@uni.ac.uk"]);
    expect(res.contributors[0].names).toEqual(
      expect.arrayContaining(["josh smith", "josh-smith"]),
    );
  });
});

describe("unifyIdentities — GitHub ID dominates", () => {
  it("merges by github id even when emails differ", () => {
    const res = unifyIdentities([
      c("a1", {
        gitName: "Josh",
        gitEmail: "josh@uni.ac.uk",
        githubLogin: "joshdev",
        githubId: 42,
      }),
      c("a2", {
        gitName: "Josh",
        gitEmail: "12345+joshdev@users.noreply.github.com",
        githubLogin: "joshdev",
        githubId: 42,
      }),
    ]);
    expect(res.contributors).toHaveLength(1);
    expect(res.contributors[0].emails).toHaveLength(2);
    expect(res.contributors[0].login).toBe("joshdev");
  });
});

describe("unifyIdentities — name fallback", () => {
  it("merges when only the normalised name matches and no GitHub id is present", () => {
    const res = unifyIdentities([
      c("a1", { gitName: "Sam Patel", gitEmail: "sam@home.com" }),
      c("a2", { gitName: "sam patel", gitEmail: "sam@work.com" }),
    ]);
    expect(res.contributors).toHaveLength(1);
    expect(res.contributors[0].emails).toEqual(["sam@home.com", "sam@work.com"]);
  });

  it("does NOT merge different humans by email when names also differ", () => {
    const res = unifyIdentities([
      c("a1", { gitName: "Alice", gitEmail: "alice@team.io" }),
      c("a2", { gitName: "Bob", gitEmail: "bob@team.io" }),
    ]);
    expect(res.contributors).toHaveLength(2);
  });
});

describe("unifyIdentities — bots", () => {
  it("flags dependabot[bot] as a bot", () => {
    const res = unifyIdentities([
      c("a1", {
        gitName: "dependabot[bot]",
        gitEmail: "support@dependabot.com",
        githubLogin: "dependabot[bot]",
      }),
    ]);
    expect(res.contributors[0].isBot).toBe(true);
  });

  it("flags github-actions login as a bot", () => {
    const res = unifyIdentities([
      c("a1", { githubLogin: "github-actions" }),
    ]);
    expect(res.contributors[0].isBot).toBe(true);
  });

  it("does not flag normal users as bots", () => {
    const res = unifyIdentities([
      c("a1", { gitName: "Sam", githubLogin: "samdev", githubId: 1 }),
    ]);
    expect(res.contributors[0].isBot).toBe(false);
  });
});

describe("unifyIdentities — attribution map", () => {
  it("maps every commit key to its contributor id", () => {
    const res = unifyIdentities([
      c("a1", { gitName: "Sam", gitEmail: "sam@uni.ac.uk", githubLogin: "samdev", githubId: 1 }),
      c("a2", { gitName: "Sam", gitEmail: "sam@uni.ac.uk", githubLogin: "samdev", githubId: 1 }),
      c("b1", { gitName: "Alex", gitEmail: "alex@uni.ac.uk", githubLogin: "alexdev", githubId: 2 }),
    ]);
    expect(res.attribution.get("a1")).toBe("samdev");
    expect(res.attribution.get("a2")).toBe("samdev");
    expect(res.attribution.get("b1")).toBe("alexdev");
  });
});

describe("unifyIdentities — fallback when no GitHub link", () => {
  it("uses a synthetic id when there is no github login", () => {
    const res = unifyIdentities([
      c("a1", { gitName: "Mystery Dev", gitEmail: "mystery@example.com" }),
    ]);
    expect(res.contributors[0].id).toBe("email:mystery@example.com");
    expect(res.contributors[0].displayName).toBe("Mystery Dev");
    expect(res.contributors[0].login).toBeNull();
  });
});
