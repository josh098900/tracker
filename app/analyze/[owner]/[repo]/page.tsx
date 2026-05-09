import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getOrComputeAnalysis } from "@/lib/analysis/runAnalysis";
import { buildColourMap } from "@/components/charts/palette";
import { DashboardCharts } from "@/app/analyze/[owner]/[repo]/DashboardCharts";

type RouteParams = { owner: string; repo: string };

export default async function AnalyzeRepoPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { owner, repo } = await params;

  let result;
  try {
    result = await getOrComputeAnalysis(owner, repo);
  } catch (err) {
    return <ErrorState owner={owner} repo={repo} error={err} />;
  }

  const { payload, cacheHit } = result;
  const colourMap = buildColourMap(payload.contributors);
  const colourMapObj = Object.fromEntries(colourMap);

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
        {/* Header */}
        <p className="font-mono text-sm text-muted-foreground">
          {payload.repo.owner}/{payload.repo.name}
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
          {payload.totals.humanContributors} contributor
          {payload.totals.humanContributors === 1 ? "" : "s"},{" "}
          {payload.totals.commits} commits
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Default branch:{" "}
          <code className="font-mono">{payload.repo.defaultBranch}</code>
          {" · "}
          HEAD:{" "}
          <code className="font-mono">
            {payload.repo.headSha.slice(0, 7)}
          </code>
          {" · "}
          {cacheHit ? "served from cache" : "freshly analysed"}
          {" · "}
          {new Date(payload.repo.analysedAt).toLocaleString("en-GB")}
        </p>

        {/* Notes */}
        {payload.notes.length > 0 && (
          <ul className="mt-6 space-y-1 rounded-2xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
            {payload.notes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        )}

        {/* Contributors list */}
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Contributors</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {payload.contributors
              .filter((c) => !c.isBot)
              .sort((a, b) => b.commitKeys.length - a.commitKeys.length)
              .map((c, i) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div
                    className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{
                      backgroundColor:
                        colourMap.get(c.id) ?? `hsl(${i * 60}, 50%, 50%)`,
                    }}
                  >
                    {c.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 rounded-full"
                      />
                    ) : (
                      c.displayName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {c.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.commitKeys.length} commit
                      {c.commitKeys.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        </section>

        {/* Charts — client component */}
        <DashboardCharts
          payload={JSON.parse(JSON.stringify(payload))}
          colourMap={colourMapObj}
        />

        {/* What we can't see */}
        <section className="mt-10 rounded-2xl border border-border bg-muted/40 p-6">
          <h2 className="font-serif text-2xl">What We Can&apos;t See</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            This tool analyses git history only. Important contributions
            that don&apos;t show up here include:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <strong>Code quality.</strong> A 5-line elegant fix and a
              500-line copy-paste look the same to git.
            </li>
            <li>
              <strong>Pair programming.</strong> If two students sat at one
              laptop, only one gets credit.
            </li>
            <li>
              <strong>Design &amp; planning work.</strong> Whiteboards, Figma,
              meetings, documents — none of it is in git.
            </li>
            <li>
              <strong>External commits.</strong> If a teammate pushed via
              someone else&apos;s machine, attribution is wrong.
            </li>
            <li>
              <strong>Squashed history.</strong> If your team rebases
              everything into one commit before submission, this tool will
              produce nonsense.
            </li>
          </ul>
        </section>

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
