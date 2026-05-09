/**
 * Noise filter — see docs/METRICS.md.
 *
 * Files matched here are excluded from line-of-code counts and from the
 * file-ownership treemap. The fairness model only works if we filter
 * aggressively before counting volume; otherwise lockfiles dominate.
 */

const LOCKFILES = new Set<string>([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "cargo.lock",
  "gemfile.lock",
  "poetry.lock",
  "composer.lock",
  "go.sum",
]);

const GENERATED_DIR_PREFIXES = [
  "dist/",
  "out/",
  "build/",
  ".next/",
  "node_modules/",
  "__pycache__/",
  ".venv/",
  "venv/",
  "target/",
  "coverage/",
  ".nyc_output/",
];

const VENDORED_DIR_PREFIXES = ["vendor/", "third_party/", "bower_components/"];

const BINARY_EXTENSIONS = new Set<string>([
  // images
  "png", "jpg", "jpeg", "gif", "webp", "svg",
  // documents / archives / executables
  "pdf", "zip", "exe", "dll",
  // fonts
  "woff", "woff2", "ttf", "otf",
  // media
  "mp3", "mp4", "mov",
  // generic build outputs
  "min.js", "min.css", "map",
  // archive double-extension
  "tar.gz",
]);

const DATA_EXTENSIONS_THRESHOLDED = new Set<string>([
  "csv",
  "json",
  "xml",
  "sql",
]);

const DATA_FILE_BYTE_THRESHOLD = 50 * 1024;

export type NoiseReason =
  | "lockfile"
  | "generated"
  | "vendored"
  | "binary"
  | "large-data"
  | "linguist-generated"
  | "linguist-vendored";

export type NoiseClassification = {
  excluded: boolean;
  reason?: NoiseReason;
};

export type NoiseInput = {
  /** Repo-relative POSIX path. */
  path: string;
  /** Optional file size (bytes) — needed for the data-file threshold. */
  sizeBytes?: number;
  /** Honour `linguist-generated=true` from `.gitattributes`. */
  linguistGenerated?: boolean;
  /** Honour `linguist-vendored=true` from `.gitattributes`. */
  linguistVendored?: boolean;
};

const lower = (s: string) => s.toLowerCase();

/**
 * Get the file extension from a POSIX path, supporting double-extensions
 * like `tar.gz` and `min.js`. Returns the longest known double-ext when
 * present, otherwise the last `.`-separated segment.
 */
function getExtension(path: string): string | undefined {
  const base = lower(path.split("/").pop() ?? "");
  // double-extensions we care about
  for (const dbl of ["tar.gz", "min.js", "min.css"]) {
    if (base.endsWith("." + dbl)) return dbl;
  }
  const idx = base.lastIndexOf(".");
  if (idx === -1 || idx === base.length - 1) return undefined;
  return base.slice(idx + 1);
}

/**
 * Classify a single file as noise or signal.
 *
 * Order of checks matches METRICS.md: linguist overrides → lockfile →
 * generated/vendored prefix → binary extension → large data file →
 * default to signal.
 */
export function classifyFile(input: NoiseInput): NoiseClassification {
  const path = input.path.replace(/\\/g, "/");
  const lowerPath = lower(path);
  const basename = lower(path.split("/").pop() ?? "");

  if (input.linguistGenerated) {
    return { excluded: true, reason: "linguist-generated" };
  }
  if (input.linguistVendored) {
    return { excluded: true, reason: "linguist-vendored" };
  }

  if (LOCKFILES.has(basename) || basename.endsWith(".lock")) {
    return { excluded: true, reason: "lockfile" };
  }

  for (const prefix of GENERATED_DIR_PREFIXES) {
    if (lowerPath.startsWith(prefix) || lowerPath.includes("/" + prefix)) {
      return { excluded: true, reason: "generated" };
    }
  }
  for (const prefix of VENDORED_DIR_PREFIXES) {
    if (lowerPath.startsWith(prefix) || lowerPath.includes("/" + prefix)) {
      return { excluded: true, reason: "vendored" };
    }
  }

  const ext = getExtension(path);
  if (ext && BINARY_EXTENSIONS.has(ext)) {
    return { excluded: true, reason: "binary" };
  }

  if (
    ext &&
    DATA_EXTENSIONS_THRESHOLDED.has(ext) &&
    typeof input.sizeBytes === "number" &&
    input.sizeBytes > DATA_FILE_BYTE_THRESHOLD
  ) {
    return { excluded: true, reason: "large-data" };
  }

  return { excluded: false };
}

/**
 * Convenience: classify a list of files. Useful when reporting "X files
 * excluded as noise" on the dashboard.
 */
export function classifyFiles(
  inputs: NoiseInput[],
): Array<NoiseInput & NoiseClassification> {
  return inputs.map((i) => ({ ...i, ...classifyFile(i) }));
}
