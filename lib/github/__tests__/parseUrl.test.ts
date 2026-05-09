import { describe, expect, it } from "vitest";
import { githubUrlSchema, parseGithubUrl } from "../parseUrl";

describe("parseGithubUrl", () => {
  it("parses a simple https URL", () => {
    expect(parseGithubUrl("https://github.com/InterMaus1154/uop_setap_cw"))
      .toEqual({ owner: "InterMaus1154", repo: "uop_setap_cw" });
  });

  it("strips trailing slash", () => {
    expect(parseGithubUrl("https://github.com/foo/bar/")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it("strips trailing .git", () => {
    expect(parseGithubUrl("https://github.com/foo/bar.git")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it("strips trailing .git and slash", () => {
    expect(parseGithubUrl("https://github.com/foo/bar.git/")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it("trims whitespace", () => {
    expect(parseGithubUrl("  https://github.com/foo/bar  ")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it("accepts owner/repo with dots and hyphens", () => {
    expect(parseGithubUrl("https://github.com/some-org/cool.repo-name"))
      .toEqual({ owner: "some-org", repo: "cool.repo-name" });
  });

  it("accepts http (will be normalised by callers)", () => {
    expect(parseGithubUrl("http://github.com/foo/bar")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it.each([
    "https://gitlab.com/foo/bar",
    "https://github.com/foo",
    "https://github.com/foo/bar/tree/main",
    "https://github.com/foo/bar/issues/1",
    "github.com/foo/bar",
    "not a url",
    "",
    "https://github.com//bar",
  ])("rejects invalid URL: %s", (bad) => {
    expect(() => parseGithubUrl(bad)).toThrow();
  });
});

describe("githubUrlSchema", () => {
  it("returns success for a valid URL", () => {
    expect(
      githubUrlSchema.safeParse("https://github.com/foo/bar").success,
    ).toBe(true);
  });

  it("returns failure with a friendly message for invalid input", () => {
    const result = githubUrlSchema.safeParse("not a url");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/GitHub repo URL/);
    }
  });

  it("rejects empty strings before regex", () => {
    const result = githubUrlSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});
