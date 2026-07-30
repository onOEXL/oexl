import { execFileSync } from "node:child_process";

const [baseSha, headSha] = process.argv.slice(2);
if (!baseSha || !headSha) {
  console.error(
    "Usage: node scripts/check-commit-standards.mjs <base-sha> <head-sha>"
  );
  process.exit(2);
}

const headerPattern =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)\([a-z0-9]+(?:-[a-z0-9]+)*\)!?: [a-z0-9].*[^.]$/;

function problemsFor(header, label) {
  const problems = [];
  if (!headerPattern.test(header)) {
    problems.push(
      `${label}: expected <type>(<scope>): <lower-case imperative summary>`
    );
  }
  if (header.length > 72) {
    problems.push(
      `${label}: header is ${header.length} characters; maximum is 72`
    );
  }
  return problems;
}

const output = execFileSync(
  "git",
  ["log", "--format=%H%x1f%s%x1e", `${baseSha}..${headSha}`],
  { encoding: "utf8" }
);

const failures = output
  .split("\x1e")
  .map((record) => record.trim())
  .filter(Boolean)
  .flatMap((record) => {
    const [sha = "", header = ""] = record.split("\x1f");
    return problemsFor(header, sha.slice(0, 12));
  });

const prTitle = process.env.PR_TITLE?.trim();
if (prTitle) failures.push(...problemsFor(prTitle, "pull request title"));

if (failures.length > 0) {
  console.error("Commit policy violations:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
