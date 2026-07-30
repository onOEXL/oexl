import { execFileSync } from "node:child_process";

const forbiddenPrefixes = [
  "apps/api/",
  "apps/control/",
  "apps/platform/",
  "apps/wallet-broker/",
  "deploy/",
  "packages/database/",
  "packages/market/",
  "packages/payments/",
  "private/"
];

const trackedFiles = execFileSync("git", ["ls-files"], {
  encoding: "utf8"
})
  .split("\n")
  .filter(Boolean);

const violations = trackedFiles.filter((path) =>
  forbiddenPrefixes.some((prefix) => path.startsWith(prefix))
);

if (violations.length > 0) {
  console.error("Private platform paths are not allowed in this repository:");
  for (const path of violations) console.error(`- ${path}`);
  process.exitCode = 1;
}
