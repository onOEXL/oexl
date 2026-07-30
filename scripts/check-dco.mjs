import { execFileSync } from "node:child_process";

const [baseSha, headSha] = process.argv.slice(2);
if (!baseSha || !headSha) {
  console.error("Usage: node scripts/check-dco.mjs <base-sha> <head-sha>");
  process.exit(2);
}

const output = execFileSync(
  "git",
  ["log", "--format=%H%x1f%B%x1e", `${baseSha}..${headSha}`],
  { encoding: "utf8" }
);

const failures = output
  .split("\x1e")
  .map((record) => record.trim())
  .filter(Boolean)
  .flatMap((record) => {
    const [sha = "", body = ""] = record.split("\x1f");
    return /^Signed-off-by:\s+.+\s+<[^<>@\s]+@[^<>@\s]+>$/im.test(body)
      ? []
      : [sha.trim()];
  });

if (failures.length > 0) {
  console.error("Commits missing a valid DCO Signed-off-by line:");
  for (const sha of failures) console.error(`- ${sha}`);
  process.exitCode = 1;
}
