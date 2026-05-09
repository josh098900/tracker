"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { githubUrlSchema, parseGithubUrl } from "@/lib/github/parseUrl";

export function PasteUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = githubUrlSchema.safeParse(url);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid URL");
      return;
    }
    const { owner, repo } = parseGithubUrl(parsed.data);
    startTransition(() => {
      router.push(`/analyze/${owner}/${repo}`);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-10 flex flex-col gap-3 sm:flex-row"
      aria-label="Analyse a GitHub repository"
    >
      <Input
        type="url"
        name="url"
        placeholder="https://github.com/owner/repo"
        className="font-mono h-11 sm:flex-1"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="GitHub repository URL"
        aria-invalid={error ? true : undefined}
        disabled={isPending}
        required
      />
      <Button type="submit" size="lg" className="h-11" disabled={isPending}>
        {isPending ? "Loading…" : "Analyse"}
      </Button>
      {error && (
        <p className="basis-full text-sm text-destructive sm:order-3">
          {error}
        </p>
      )}
    </form>
  );
}
