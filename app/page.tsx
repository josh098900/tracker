import { PasteUrlForm } from "@/components/PasteUrlForm";

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

        <PasteUrlForm />

        <p className="mt-3 text-sm text-muted-foreground">
          Works with any public GitHub repository. No sign-in, no setup.
        </p>
      </div>
    </main>
  );
}
