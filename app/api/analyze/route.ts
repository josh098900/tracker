import { NextResponse } from "next/server";
import { z } from "zod";

import { runM1Analysis } from "@/lib/analysis/runM1Analysis";
import type { M1AnalysisPayload } from "@/lib/analysis/types";
import { getCache } from "@/lib/cache";
import { fetchRepoMeta } from "@/lib/github/fetchRepo";
import { githubUrlSchema, parseGithubUrl } from "@/lib/github/parseUrl";
import { consumeRateLimit, ipFromHeaders } from "@/lib/rateLimit";

export const runtime = "nodejs";

const ANALYSIS_TTL_SECONDS = 60 * 60 * 24 * 7;

const requestSchema = z.object({
  url: githubUrlSchema,
});

type AnalyzeError = {
  code:
    | "invalid_input"
    | "rate_limited"
    | "not_found"
    | "private_or_no_access"
    | "github_unavailable"
    | "internal_error";
  message: string;
  details?: unknown;
};

/**
 * POST /api/analyze
 *
 * Body: `{ url: string }`. Returns the M1 analysis payload as JSON
 * (SSE streaming arrives in M3). Cached by `${owner}/${repo}@${headSha}`
 * for 7 days. Rate-limited at 10 cache-miss analyses per hour per IP.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = ipFromHeaders(request.headers);

  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, {
      code: "invalid_input",
      message: "Body must be { url: string } where url is a public GitHub repo.",
      details: parsed.error?.issues,
    });
  }

  let owner: string;
  let repo: string;
  try {
    ({ owner, repo } = parseGithubUrl(parsed.data.url));
  } catch (err) {
    return errorResponse(400, {
      code: "invalid_input",
      message: err instanceof Error ? err.message : "Invalid URL.",
    });
  }

  // Cache hit fast path — check before consuming rate-limit budget.
  let headSha: string;
  try {
    const meta = await fetchRepoMeta(owner, repo);
    headSha = meta.headSha;
    owner = meta.owner;
    repo = meta.name;
  } catch (err) {
    return mapGithubError(err);
  }

  const cache = getCache();
  const cacheKey = `analysis:${owner}/${repo}@${headSha}`;
  const cached = await cache.get<M1AnalysisPayload>(cacheKey);
  if (cached) {
    return jsonWithRateHeaders(
      cached,
      { limit: 10, remaining: 10 },
      true,
    );
  }

  // Cache miss — consume rate limit before doing real work.
  const verdict = await consumeRateLimit(ip);
  if (!verdict.allowed) {
    return errorResponse(
      429,
      {
        code: "rate_limited",
        message: `Rate limit exceeded — max ${verdict.limit} analyses per hour per IP. Cached results don't count.`,
      },
      { "Retry-After": String(verdict.retryAfter) },
    );
  }

  let payload: M1AnalysisPayload;
  try {
    payload = await runM1Analysis(owner, repo);
  } catch (err) {
    return mapGithubError(err);
  }

  await cache.set(cacheKey, payload, ANALYSIS_TTL_SECONDS);
  return jsonWithRateHeaders(payload, verdict, false);
}

/**
 * GET /api/analyze?url=https://github.com/owner/repo
 *
 * Convenience for the dashboard page (M2 will likely consume this) and
 * for `curl` smoke-tests during M1 acceptance. Same caching + rate-limit
 * behaviour as POST.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return errorResponse(400, {
      code: "invalid_input",
      message: "Missing ?url= query parameter.",
    });
  }
  // Reuse POST by synthesising a Request body.
  const synthetic = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ url }),
  });
  return POST(synthetic);
}

function jsonWithRateHeaders(
  payload: M1AnalysisPayload,
  verdict: { limit: number; remaining: number },
  cacheHit: boolean,
): NextResponse {
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "X-RateLimit-Limit": String(verdict.limit),
      "X-RateLimit-Remaining": String(verdict.remaining),
      "X-Cache": cacheHit ? "HIT" : "MISS",
    },
  });
}

function errorResponse(
  status: number,
  body: AnalyzeError,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(body, { status, headers: extraHeaders });
}

function mapGithubError(err: unknown): NextResponse {
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status: unknown }).status)
      : 0;
  if (status === 404) {
    return errorResponse(404, {
      code: "not_found",
      message: "Repository not found. Check the URL — public repos only.",
    });
  }
  if (status === 403 || status === 401) {
    return errorResponse(403, {
      code: "private_or_no_access",
      message: "Repository is private or the server token can't access it.",
    });
  }
  if (status >= 500 && status < 600) {
    return errorResponse(503, {
      code: "github_unavailable",
      message: "GitHub returned a server error. Try again in a few minutes.",
    });
  }
  console.error("/api/analyze internal error", err);
  return errorResponse(500, {
    code: "internal_error",
    message: "Unexpected error. Check server logs.",
  });
}

