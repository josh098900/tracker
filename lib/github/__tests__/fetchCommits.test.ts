import { describe, expect, it } from "vitest";
import { parseCoAuthors } from "../fetchCommits";

describe("parseCoAuthors", () => {
  it("returns [] for a message with no trailers", () => {
    expect(parseCoAuthors("fix: typo in README")).toEqual([]);
  });

  it("parses a single Co-authored-by trailer", () => {
    const msg = `feat: add ownership treemap

Co-authored-by: Sam Patel <sam@example.com>`;
    expect(parseCoAuthors(msg)).toEqual([
      { name: "Sam Patel", email: "sam@example.com" },
    ]);
  });

  it("parses multiple trailers and lowercases emails", () => {
    const msg = `chore: pair on identity unification

Co-authored-by: Alex <Alex@Team.IO>
Co-authored-by: Bob <bob@team.io>`;
    expect(parseCoAuthors(msg)).toEqual([
      { name: "Alex", email: "alex@team.io" },
      { name: "Bob", email: "bob@team.io" },
    ]);
  });

  it("ignores malformed trailers", () => {
    const msg = `fix: x

Co-authored-by: not a real entry
Co-authored-by: Real Person <real@example.com>`;
    expect(parseCoAuthors(msg)).toEqual([
      { name: "Real Person", email: "real@example.com" },
    ]);
  });
});
