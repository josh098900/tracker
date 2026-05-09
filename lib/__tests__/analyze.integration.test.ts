import { beforeEach, describe, expect, it, vi } from "vitest";

import { _resetCacheForTests } from "../cache";

/**
 * Integration test for `POST /api/analyze` end-to-end against a tiny
 * fixture repo with Octokit mocked out. Required by DEFINITION_OF_DONE.md.
 *
 * Strategy: stub `getOctokit()` to return a hand-rolled object with the
 * three Octokit methods the analyser calls (`repos.get`, `repos.getBranch`,
 * `repos.listCommits`, `pulls.list`). This avoids any network and proves
 * the wiring (route → cache → rate-limit → fetchers → unification) all
 * holds together.
 */

const mockOctokit = {
  rest: {
    repos: {
      get: vi.fn(),
      getBranch: vi.fn(),
      listCommits: vi.fn(),
    },
    pulls: {
      list: vi.fn(),
    },
    git: {
      getTree: vi.fn(),
    },
  },
  request: vi.fn(),
};

vi.mock("../github/client", () => ({
  getOctokit: () => mockOctokit,
  _resetOctokitForTests: () => {},
}));

beforeEach(() => {
  _resetCacheForTests();
  for (const fn of [
    mockOctokit.rest.repos.get,
    mockOctokit.rest.repos.getBranch,
    mockOctokit.rest.repos.listCommits,
    mockOctokit.rest.pulls.list,
    mockOctokit.rest.git.getTree,
    mockOctokit.request,
  ]) {
    fn.mockReset();
  }

  mockOctokit.rest.repos.get.mockResolvedValue({
    data: {
      owner: { login: "fixture-org" },
      name: "fixture-repo",
      default_branch: "main",
      private: false,
      archived: false,
      size: 100,
      stargazers_count: 0,
      pushed_at: "2025-05-01T00:00:00Z",
    },
  });
  mockOctokit.rest.repos.getBranch.mockResolvedValue({
    data: { commit: { sha: "abc1234" } },
  });
  mockOctokit.rest.repos.listCommits.mockResolvedValue({
    data: [
      {
        sha: "c1",
        commit: {
          message: "feat: initial",
          author: { name: "Sam", email: "sam@uni.ac.uk", date: "2025-04-01T10:00:00Z" },
        },
        author: { login: "samdev", id: 1, avatar_url: "https://example.test/sam.png" },
      },
      {
        sha: "c2",
        commit: {
          message: "fix: typo\n\nCo-authored-by: Alex <alex@uni.ac.uk>",
          author: { name: "Sam", email: "sam@uni.ac.uk", date: "2025-04-02T10:00:00Z" },
        },
        author: { login: "samdev", id: 1, avatar_url: "https://example.test/sam.png" },
      },
      {
        sha: "c3",
        commit: {
          message: "docs: readme",
          author: { name: "Alex", email: "alex@uni.ac.uk", date: "2025-04-03T10:00:00Z" },
        },
        author: { login: "alexdev", id: 2, avatar_url: "https://example.test/alex.png" },
      },
    ],
  });
  mockOctokit.rest.pulls.list.mockResolvedValue({ data: [] });
  // M2: mock stats APIs (return empty/200 for basic tests)
  mockOctokit.request.mockResolvedValue({ status: 200, data: [] });
  // M2: mock tree API
  mockOctokit.rest.git.getTree.mockResolvedValue({ data: { tree: [] } });
});

async function importRoute() {
  // Import lazily so the mock above is in place first.
  return await import("../../app/api/analyze/route");
}

function makeRequest(url: string, body: unknown, ip = "1.2.3.4") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze", () => {
  it("returns a normalised payload for a small fixture repo", async () => {
    const { POST } = await importRoute();
    const res = await POST(
      makeRequest("http://localhost/api/analyze", {
        url: "https://github.com/fixture-org/fixture-repo",
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("MISS");
    const json = await res.json();
    expect(json.repo.owner).toBe("fixture-org");
    expect(json.repo.headSha).toBe("abc1234");
    expect(json.totals.commits).toBe(3);
    expect(json.totals.humanContributors).toBe(2);
    expect(json.contributors.map((c: { login: string }) => c.login)).toEqual([
      "samdev",
      "alexdev",
    ]);
  });

  it("hits the cache on a second identical request", async () => {
    const { POST } = await importRoute();
    await POST(
      makeRequest("http://localhost/api/analyze", {
        url: "https://github.com/fixture-org/fixture-repo",
      }),
    );
    const res2 = await POST(
      makeRequest("http://localhost/api/analyze", {
        url: "https://github.com/fixture-org/fixture-repo",
      }),
    );
    expect(res2.headers.get("X-Cache")).toBe("HIT");
    // listCommits should only have been called once (the first time).
    expect(mockOctokit.rest.repos.listCommits).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid URL with 400", async () => {
    const { POST } = await importRoute();
    const res = await POST(
      makeRequest("http://localhost/api/analyze", { url: "not a url" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("invalid_input");
  });

  it("returns 429 once the rate limit is exhausted", async () => {
    const { POST } = await importRoute();
    // Force every request to be a cache miss by using a unique repo path
    // each iteration. The meta and analysis caches are both keyed by
    // `${owner}/${repo}` so a new path bypasses both.
    mockOctokit.rest.repos.get.mockImplementation(async ({ repo }) => ({
      data: {
        owner: { login: "fixture-org" },
        name: repo,
        default_branch: "main",
        private: false,
        archived: false,
        size: 100,
        stargazers_count: 0,
        pushed_at: "2025-05-01T00:00:00Z",
      },
    }));

    let last: Response | undefined;
    for (let i = 0; i < 11; i += 1) {
      last = await POST(
        makeRequest("http://localhost/api/analyze", {
          url: `https://github.com/fixture-org/repo-${i}`,
        }),
      );
    }
    expect(last?.status).toBe(429);
    const json = await last?.json();
    expect(json.code).toBe("rate_limited");
  });

  it("maps a GitHub 404 to the not_found error code", async () => {
    mockOctokit.rest.repos.get.mockRejectedValueOnce(
      Object.assign(new Error("Not Found"), { status: 404 }),
    );
    const { POST } = await importRoute();
    const res = await POST(
      makeRequest("http://localhost/api/analyze", {
        url: "https://github.com/fixture-org/missing",
      }),
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("not_found");
  });
});
