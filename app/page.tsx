import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  return (
    <main className="flex flex-1 items-center">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
        <p className="font-mono text-sm text-muted-foreground">
          contribution-analyser
        </p>
        <h1 className="mt-6 font-serif text-6xl tracking-tight md:text-7xl">
          See who actually
          <br />
          built the project.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Paste a public GitHub repo and get an honest, defensible breakdown of
          everyone&apos;s contribution &mdash; commits, lines, ownership,
          consistency, balance score &mdash; in about ten seconds.
        </p>

        <form
          className="mt-10 flex flex-col gap-3 sm:flex-row"
          action="/"
          aria-label="Analyse a GitHub repository"
        >
          <Input
            type="url"
            name="url"
            placeholder="https://github.com/owner/repo"
            className="font-mono h-11 sm:flex-1"
            disabled
            aria-label="GitHub repository URL"
          />
          <Button type="submit" size="lg" className="h-11" disabled>
            Analyse
          </Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          The form is wired up in M1. Right now this page just proves the M0
          scaffold &mdash; fonts, colours, and shadcn primitives.
        </p>
      </div>
    </main>
  );
}
