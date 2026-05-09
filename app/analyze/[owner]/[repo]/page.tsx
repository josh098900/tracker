import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getOrComputeM1Analysis } from "@/lib/analysis/runM1Analysis";

type RouteParams = { owner: string; repo: string };

export default async function AnalyzeRepoPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { owner, repo } = await params;

  let result;
  try {
    result = await getOrComputeM1Analysis(owner, repo);
  } catch (err) {
    return <ErrorState owner={owner} repo={repo} error={err} />;
  }

  const { payload, cacheHit } = result;

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
        <p className="font-mono text-sm text-muted-foreground">
          {payload.repo.owner}/{payload.repo.name}
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
          {payload.totals.humanContributors} contributor
          {payload.totals.humanContributors === 1 ? "" : "s"},{" "}
          {payload.totals.commits} commits
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Default branch: <code className="font-mono">{payload.repo.defaultBranch}</code>
          {" · "}
          HEAD: <code className="font-mono">{payload.repo.headSha.slice(0, 7)}</code>
          {" · "}
          {cacheHit ? "served from cache" : "freshly analysed"}
          {" · "}
          {new Date(payload.repo.analysedAt).toLocaleString("en-GB")}
        </p>

        {payload.notes.length > 0 && (
          <ul className="mt-6 space-y-1 rounded-2xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
            {payload.notes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        )}

        <section className="mt-10">
          <h2 className="font-serif text-2xl">Contributors</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            M1 surfaces unified identities and commit counts. Charts and the
            balance score arrive in M2 / M3.
          </p>

          <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
            {payload.contributors.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {c.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.avatarUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 rounded-full bg-muted"
                    />
                  ) : (
                    <div className="size-9 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {c.displayName}
                      {c.isBot && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          bot
                        </span>
                      )}
                    </p>
                    {c.login && (
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        @{c.login}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">
                    {c.commitKeys.length} commit
                    {c.commitKeys.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-muted-foreground">
                    {c.emails.length} email{c.emails.length === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <details className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm">
          <summary className="cursor-pointer font-medium">
            Raw payload (M1 debug view)
          </summary>
          <pre className="mt-4 overflow-x-auto font-mono text-xs leading-relaxed text-muted-foreground">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>

        <div className="mt-10">
          <Link href="/">
            <Button variant="outline">← Analyse another repo</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorState({
  owner,
  repo,
  error,
}: {
  owner: string;
  repo: string;
  error: unknown;
}) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status: unknown }).status)
      : 0;
  const message =
    status === 404
      ? "Repository not found. Check the URL — public repos only."
      : status === 403 || status === 401
        ? "Repository is private, or the server token cannot access it."
        : status >= 500
          ? "GitHub is having a moment. Try again in a few minutes."
          : "Something went wrong while analysing this repo.";

  return (
    <main className="flex flex-1 items-center">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
        <p className="font-mono text-sm text-muted-foreground">
          {owner}/{repo}
        </p>
        <h1 className="mt-6 font-serif text-4xl tracking-tight">
          Couldn&apos;t analyse this repo.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">{message}</p>
        <div className="mt-10">
          <Link href="/">
            <Button>← Try a different URL</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
