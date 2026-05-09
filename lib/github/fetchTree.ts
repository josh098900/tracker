import { getOctokit } from "./client";

export type TreeEntry = {
  /** Repo-relative POSIX path. */
  path: string;
  type: "blob" | "tree";
  /** File size in bytes (only for blobs). */
  size: number;
};

/**
 * Fetch the full recursive file tree for the given SHA (usually the
 * head commit of the default branch). Used by the file-ownership
 * treemap to know what files exist and how large they are.
 *
 * The `?recursive=1` flag returns the entire tree in a single API
 * call (for repos under ~100k entries — well within our target scope
 * of university coursework repos).
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  treeSha: string,
): Promise<TreeEntry[]> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: "1",
  });

  return (data.tree ?? [])
    .filter(
      (entry): entry is typeof entry & { path: string } =>
        typeof entry.path === "string",
    )
    .map((entry) => ({
      path: entry.path,
      type: entry.type === "tree" ? ("tree" as const) : ("blob" as const),
      size: entry.size ?? 0,
    }));
}
