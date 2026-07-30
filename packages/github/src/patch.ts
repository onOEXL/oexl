// Applies a unified diff to base file contents to produce the file set a commit
// needs. This is what makes "deliverable as a pull request" possible: GitHub has
// no API that accepts a raw patch, so the branch contents must be constructed.
//
// It is intentionally strict — a hunk whose context/removed lines do not match
// the base throws, so a stale or malformed patch fails loudly rather than
// producing a corrupt commit.

export class PatchApplyError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export type PlannedChange =
  | { path: string; kind: "add" | "modify"; content: string }
  | { path: string; kind: "delete" };

type Hunk = { oldStart: number; lines: string[] };

type FileDiff = {
  oldPath: string | null; // null = /dev/null (creation)
  newPath: string | null; // null = /dev/null (deletion)
  hunks: Hunk[];
};

const stripPrefix = (raw: string): string | null => {
  const path = raw.split("\t")[0]!.trim();
  if (path === "/dev/null") return null;
  return path.startsWith("a/") || path.startsWith("b/") ? path.slice(2) : path;
};

const splitLines = (
  content: string
): { lines: string[]; trailingNewline: boolean } => {
  if (content === "") return { lines: [], trailingNewline: false };
  const trailingNewline = content.endsWith("\n");
  const body = trailingNewline ? content.slice(0, -1) : content;
  return { lines: body.split("\n"), trailingNewline };
};

const parseFileDiffs = (patch: string): FileDiff[] => {
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;
  let hunk: Hunk | null = null;
  const closeHunk = () => {
    if (current && hunk) current.hunks.push(hunk);
    hunk = null;
  };
  const closeFile = () => {
    closeHunk();
    if (current) files.push(current);
    current = null;
  };
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      closeFile();
      current = { oldPath: null, newPath: null, hunks: [] };
      continue;
    }
    if (!current) continue;
    if (hunk === null) {
      if (line.startsWith("--- ")) current.oldPath = stripPrefix(line.slice(4));
      else if (line.startsWith("+++ "))
        current.newPath = stripPrefix(line.slice(4));
      else if (line.startsWith("@@")) {
        const match = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(line);
        if (!match)
          throw new PatchApplyError(
            "OEXL_PATCH_INVALID",
            "Malformed hunk header"
          );
        hunk = { oldStart: Number(match[1]), lines: [] };
      }
      continue;
    }
    // Inside a hunk.
    if (line.startsWith("@@")) {
      closeHunk();
      const match = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(line);
      if (!match)
        throw new PatchApplyError(
          "OEXL_PATCH_INVALID",
          "Malformed hunk header"
        );
      hunk = { oldStart: Number(match[1]), lines: [] };
    } else if (line.startsWith("diff --git ")) {
      closeFile();
      current = { oldPath: null, newPath: null, hunks: [] };
    } else if (
      line.startsWith(" ") ||
      line.startsWith("+") ||
      line.startsWith("-") ||
      line.startsWith("\\")
    ) {
      hunk.lines.push(line);
    } else {
      // A blank or unexpected line ends the hunk body.
      closeHunk();
    }
  }
  closeFile();
  return files;
};

const applyHunks = (base: string, hunks: Hunk[]): string => {
  const { lines, trailingNewline } = splitLines(base);
  const out: string[] = [];
  let cursor = 0; // 0-indexed position in base lines
  let noFinalNewline = !trailingNewline && lines.length > 0;
  for (const hunk of hunks) {
    // oldStart is 0 for a pure creation hunk (@@ -0,0 ... @@); clamp to 0.
    const target = Math.max(0, hunk.oldStart - 1);
    if (target < cursor || target > lines.length)
      throw new PatchApplyError(
        "OEXL_PATCH_DOES_NOT_APPLY",
        "Hunk position is out of range"
      );
    while (cursor < target) out.push(lines[cursor++]!);
    for (const raw of hunk.lines) {
      if (raw.startsWith("\\")) {
        noFinalNewline = true;
        continue;
      }
      const kind = raw[0];
      const text = raw.slice(1);
      if (kind === " ") {
        if (lines[cursor] !== text)
          throw new PatchApplyError(
            "OEXL_PATCH_DOES_NOT_APPLY",
            "Context line does not match the base file"
          );
        out.push(text);
        cursor++;
      } else if (kind === "-") {
        if (lines[cursor] !== text)
          throw new PatchApplyError(
            "OEXL_PATCH_DOES_NOT_APPLY",
            "Removed line does not match the base file"
          );
        cursor++;
      } else if (kind === "+") {
        out.push(text);
      }
    }
  }
  while (cursor < lines.length) out.push(lines[cursor++]!);
  const joined = out.join("\n");
  return joined.length === 0 || noFinalNewline ? joined : `${joined}\n`;
};

/**
 * Turns a unified diff into a concrete set of file changes, reading each base
 * file through `readBase` (returns null when the file does not exist at the
 * base). Throws PatchApplyError if any hunk fails to apply cleanly.
 */
export function planChangesFromDiff(
  patch: string,
  readBase: (path: string) => string | null
): PlannedChange[] {
  const changes: PlannedChange[] = [];
  for (const file of parseFileDiffs(patch)) {
    if (file.newPath === null && file.oldPath !== null) {
      changes.push({ path: file.oldPath, kind: "delete" });
      continue;
    }
    if (file.newPath === null)
      throw new PatchApplyError(
        "OEXL_PATCH_INVALID",
        "File diff names no target path"
      );
    const base = file.oldPath === null ? "" : (readBase(file.oldPath) ?? "");
    const content = applyHunks(base, file.hunks);
    changes.push({
      path: file.newPath,
      kind: file.oldPath === null ? "add" : "modify",
      content
    });
    // A rename that also edits leaves the old path behind; delete it.
    if (file.oldPath !== null && file.oldPath !== file.newPath)
      changes.push({ path: file.oldPath, kind: "delete" });
  }
  return changes;
}

/**
 * The set of base paths whose current content is needed to apply the diff
 * (modified/deleted files; pure additions need nothing read).
 */
export function basePathsNeeded(patch: string): string[] {
  const paths = new Set<string>();
  for (const file of parseFileDiffs(patch))
    if (file.oldPath !== null) paths.add(file.oldPath);
  return [...paths];
}
