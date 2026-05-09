/**
 * File ownership — see docs/METRICS.md.
 *
 * > ⚠️ For MVP, approximate ownership by *last-touched author per file*.
 * > True blame is a phase-2 enhancement that would require server-side
 * > cloning.
 *
 * We walk the commit list (most recent first) and for each file
 * touched, attribute ownership to the first (most recent) author
 * we encounter. The result is a tree structure suitable for the
 * visx Treemap component.
 */

import type { CommitRecord } from "@/lib/github/types";
import type { TreeEntry } from "@/lib/github/fetchTree";
import type { UnifiedContributor } from "./identityUnification";
import { classifyFile } from "./noiseFilter";

export type OwnershipNode = {
  name: string;
  /** Absolute path from repo root. */
  path: string;
  /** File size in bytes. 0 for directories. */
  size: number;
  /** Contributor id of the owner. Null for directories. */
  owner: string | null;
  /** Children (for directories). */
  children?: OwnershipNode[];
};

/**
 * Build a file-ownership treemap from the repo tree + commit history.
 *
 * Strategy (MVP):
 * 1. Sort commits by date descending.
 * 2. For each commit with file-level data, mark each file's owner as
 *    the commit author (first writer wins = most recent author).
 * 3. Use the full tree to build the nested structure, filtering noise.
 */
export function buildFileOwnership(
  tree: TreeEntry[],
  commits: CommitRecord[],
  contributors: UnifiedContributor[],
): OwnershipNode {
  // Build login/id → contributor.id lookup
  const loginToId = new Map<string, string>();
  const ghIdToId = new Map<number, string>();
  for (const c of contributors) {
    if (c.login) loginToId.set(c.login.toLowerCase(), c.id);
    if (c.githubId !== null) ghIdToId.set(c.githubId, c.id);
  }

  const resolveId = (login: string | null, ghId: number | null): string | null => {
    if (ghId !== null && ghIdToId.has(ghId)) return ghIdToId.get(ghId)!;
    if (login && loginToId.has(login.toLowerCase()))
      return loginToId.get(login.toLowerCase())!;
    return null;
  };

  // Walk commits (most recent first) to build file → owner map
  const fileOwner = new Map<string, string>();
  const sorted = [...commits].sort(
    (a, b) => new Date(b.authoredAt).getTime() - new Date(a.authoredAt).getTime(),
  );

  for (const commit of sorted) {
    if (!commit.files) continue;
    const authorId = resolveId(commit.author.login, commit.author.githubId);
    if (!authorId) continue;

    for (const file of commit.files) {
      if (!fileOwner.has(file.filename)) {
        fileOwner.set(file.filename, authorId);
      }
    }
  }

  // Filter tree to meaningful blobs only
  const blobs = tree.filter((entry) => {
    if (entry.type !== "blob") return false;
    return !classifyFile({ path: entry.path, sizeBytes: entry.size }).excluded;
  });

  // Build nested tree structure
  const root: OwnershipNode = {
    name: "/",
    path: "",
    size: 0,
    owner: null,
    children: [],
  };

  for (const blob of blobs) {
    const parts = blob.path.split("/");
    let current = root;

    // Navigate / create directory nodes
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      let child = current.children?.find((c) => c.name === dirName);
      if (!child) {
        child = {
          name: dirName,
          path: parts.slice(0, i + 1).join("/"),
          size: 0,
          owner: null,
          children: [],
        };
        current.children ??= [];
        current.children.push(child);
      }
      current = child;
    }

    // Add file leaf
    const fileName = parts[parts.length - 1];
    current.children ??= [];
    current.children.push({
      name: fileName,
      path: blob.path,
      size: Math.max(blob.size, 1), // treemap needs non-zero size
      owner: fileOwner.get(blob.path) ?? null,
    });
  }

  return root;
}

/**
 * Compute per-contributor ownership share from a tree.
 * Returns a map of contributor id → fraction of total LOC owned.
 */
export function computeOwnershipShares(
  root: OwnershipNode,
): Map<string, number> {
  const ownerBytes = new Map<string, number>();
  let totalBytes = 0;

  function walk(node: OwnershipNode): void {
    if (node.children) {
      for (const child of node.children) walk(child);
    } else if (node.owner) {
      ownerBytes.set(node.owner, (ownerBytes.get(node.owner) ?? 0) + node.size);
      totalBytes += node.size;
    }
  }

  walk(root);

  const shares = new Map<string, number>();
  if (totalBytes === 0) return shares;
  for (const [id, bytes] of ownerBytes) {
    shares.set(id, bytes / totalBytes);
  }
  return shares;
}
