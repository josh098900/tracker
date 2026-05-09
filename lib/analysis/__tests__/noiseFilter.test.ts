import { describe, expect, it } from "vitest";
import { classifyFile } from "../noiseFilter";

describe("classifyFile — lockfiles", () => {
  it.each([
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "Cargo.lock",
    "Gemfile.lock",
    "poetry.lock",
    "composer.lock",
    "go.sum",
    "subdir/package-lock.json",
    "frontend/yarn.lock",
  ])("excludes %s as a lockfile", (path) => {
    const result = classifyFile({ path });
    expect(result.excluded).toBe(true);
    expect(result.reason).toBe("lockfile");
  });

  it("excludes any *.lock file by extension fallback", () => {
    expect(classifyFile({ path: "tools/random.lock" })).toEqual({
      excluded: true,
      reason: "lockfile",
    });
  });
});

describe("classifyFile — generated / build outputs", () => {
  it.each([
    "dist/index.js",
    "out/page.html",
    "build/main.js",
    ".next/server/chunks/foo.js",
    "node_modules/lodash/index.js",
    "coverage/lcov-report/index.html",
    "packages/foo/dist/index.js",
    "apps/web/.next/build/foo.js",
  ])("excludes %s as generated", (path) => {
    const result = classifyFile({ path });
    expect(result.excluded).toBe(true);
    expect(result.reason).toBe("generated");
  });

  it.each(["src/dist-helpers/foo.ts", "lib/build-utils.ts"])(
    "does NOT confuse word-boundary file names with generated dirs (%s)",
    (path) => {
      const result = classifyFile({ path });
      expect(result.excluded).toBe(false);
    },
  );
});

describe("classifyFile — vendored", () => {
  it.each([
    "vendor/jquery.min.js",
    "third_party/some-lib/index.js",
    "bower_components/foo/index.html",
    "packages/x/vendor/lib.js",
  ])("excludes %s as vendored", (path) => {
    const result = classifyFile({ path });
    expect(result.excluded).toBe(true);
  });
});

describe("classifyFile — binaries", () => {
  it.each([
    "public/logo.png",
    "design/screenshot.JPG",
    "public/anim.gif",
    "fonts/inter.woff2",
    "media/intro.mp4",
    "docs/spec.pdf",
    "public/main.min.js",
    "static/styles.min.css",
    "src/main.js.map",
    "archive.tar.gz",
  ])("excludes %s as binary", (path) => {
    const result = classifyFile({ path });
    expect(result.excluded).toBe(true);
    expect(result.reason).toBe("binary");
  });
});

describe("classifyFile — large data files", () => {
  it("includes a small CSV", () => {
    expect(classifyFile({ path: "data/users.csv", sizeBytes: 1_024 })).toEqual({
      excluded: false,
    });
  });

  it("excludes a CSV over 50 KB", () => {
    expect(
      classifyFile({ path: "data/users.csv", sizeBytes: 200_000 }),
    ).toEqual({ excluded: true, reason: "large-data" });
  });

  it("excludes a large JSON dump", () => {
    expect(
      classifyFile({ path: "fixtures/big.json", sizeBytes: 500_000 }),
    ).toEqual({ excluded: true, reason: "large-data" });
  });

  it("does not exclude a JSON file when size is unknown (avoid false positives)", () => {
    expect(classifyFile({ path: "config.json" })).toEqual({ excluded: false });
  });
});

describe("classifyFile — linguist overrides", () => {
  it("excludes when linguistGenerated is true even for normal source files", () => {
    expect(
      classifyFile({ path: "src/generated.ts", linguistGenerated: true }),
    ).toEqual({ excluded: true, reason: "linguist-generated" });
  });

  it("excludes when linguistVendored is true", () => {
    expect(
      classifyFile({ path: "src/some.ts", linguistVendored: true }),
    ).toEqual({ excluded: true, reason: "linguist-vendored" });
  });
});

describe("classifyFile — defaults", () => {
  it.each([
    "src/index.ts",
    "components/Button.tsx",
    "README.md",
    "Makefile",
    "package.json",
  ])("includes %s as signal", (path) => {
    expect(classifyFile({ path })).toEqual({ excluded: false });
  });
});
