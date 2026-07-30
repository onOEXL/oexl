import { describe, expect, it } from "vitest";
import {
  PatchApplyError,
  basePathsNeeded,
  planChangesFromDiff
} from "./patch.js";

const readBase = (files: Record<string, string>) => (path: string) =>
  files[path] ?? null;

describe("planChangesFromDiff", () => {
  it("applies a single-line modification", () => {
    const patch =
      "diff --git a/src/greeting.ts b/src/greeting.ts\n" +
      "--- a/src/greeting.ts\n+++ b/src/greeting.ts\n" +
      "@@ -1 +1 @@\n-export const greeting = 'Hello';\n+export const greeting = 'Hi';\n";
    const changes = planChangesFromDiff(
      patch,
      readBase({ "src/greeting.ts": "export const greeting = 'Hello';\n" })
    );
    expect(changes).toEqual([
      {
        path: "src/greeting.ts",
        kind: "modify",
        content: "export const greeting = 'Hi';\n"
      }
    ]);
  });

  it("applies a multi-line hunk with context", () => {
    const base = ["one", "two", "three", "four", ""].join("\n");
    const patch =
      "diff --git a/f.txt b/f.txt\n--- a/f.txt\n+++ b/f.txt\n" +
      "@@ -1,4 +1,4 @@\n one\n-two\n+TWO\n three\n four\n";
    const changes = planChangesFromDiff(patch, readBase({ "f.txt": base }));
    expect(changes[0]).toMatchObject({
      kind: "modify",
      content: "one\nTWO\nthree\nfour\n"
    });
  });

  it("creates a new file from /dev/null", () => {
    const patch =
      "diff --git a/src/new.ts b/src/new.ts\n--- /dev/null\n+++ b/src/new.ts\n" +
      "@@ -0,0 +1,2 @@\n+export const a = 1;\n+export const b = 2;\n";
    expect(planChangesFromDiff(patch, readBase({}))).toEqual([
      {
        path: "src/new.ts",
        kind: "add",
        content: "export const a = 1;\nexport const b = 2;\n"
      }
    ]);
  });

  it("deletes a file targeting /dev/null", () => {
    const patch =
      "diff --git a/old.ts b/old.ts\n--- a/old.ts\n+++ /dev/null\n" +
      "@@ -1 +0,0 @@\n-gone\n";
    expect(
      planChangesFromDiff(patch, readBase({ "old.ts": "gone\n" }))
    ).toEqual([{ path: "old.ts", kind: "delete" }]);
  });

  it("rejects a patch whose context does not match the base", () => {
    const patch =
      "diff --git a/f.ts b/f.ts\n--- a/f.ts\n+++ b/f.ts\n@@ -1 +1 @@\n-was this\n+now this\n";
    expect(() =>
      planChangesFromDiff(patch, readBase({ "f.ts": "something else\n" }))
    ).toThrow(PatchApplyError);
  });

  it("reports which base files must be read", () => {
    const patch =
      "diff --git a/keep.ts b/keep.ts\n--- a/keep.ts\n+++ b/keep.ts\n@@ -1 +1 @@\n-a\n+b\n" +
      "diff --git a/new.ts b/new.ts\n--- /dev/null\n+++ b/new.ts\n@@ -0,0 +1 @@\n+x\n";
    expect(basePathsNeeded(patch)).toEqual(["keep.ts"]);
  });
});
