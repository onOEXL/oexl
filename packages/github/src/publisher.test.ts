import { describe, expect, it } from "vitest";
import type { GithubRepoClient, PullRequestTarget } from "./client.js";
import {
  DeliverablePrPublisher,
  type DeliverablePrContext
} from "./publisher.js";

const patch =
  "diff --git a/src/greeting.ts b/src/greeting.ts\n" +
  "--- a/src/greeting.ts\n+++ b/src/greeting.ts\n" +
  "@@ -1 +1 @@\n-export const greeting = 'Hello';\n+export const greeting = 'Hi';\n";

const context: DeliverablePrContext = {
  installationId: 42,
  owner: "acme",
  repo: "widget",
  issueNumber: 7,
  baseSha: "a".repeat(40),
  patch,
  deliverableId: "dlv_abc"
};

class FakeClient implements GithubRepoClient {
  reads: string[] = [];
  opened: unknown;
  comments: Array<{ issueNumber: number; body: string }> = [];
  constructor(private readonly base: Record<string, string>) {}
  readFile(_t: PullRequestTarget, _sha: string, path: string) {
    this.reads.push(path);
    return Promise.resolve(this.base[path] ?? null);
  }
  openPullRequest(
    _t: PullRequestTarget,
    input: { branch: string; changes: unknown }
  ) {
    this.opened = input;
    return Promise.resolve({
      number: 99,
      url: "https://github.com/acme/widget/pull/99"
    });
  }
  commentIssue(_t: PullRequestTarget, issueNumber: number, body: string) {
    this.comments.push({ issueNumber, body });
    return Promise.resolve();
  }
}

describe("DeliverablePrPublisher", () => {
  it("reads the base, applies the patch, opens a PR, and comments the issue", async () => {
    const client = new FakeClient({
      "src/greeting.ts": "export const greeting = 'Hello';\n"
    });
    const publisher = new DeliverablePrPublisher(client, () =>
      Promise.resolve(context)
    );
    const result = await publisher.publish("dlv_abc");

    expect(result).toEqual({
      kind: "opened",
      prNumber: 99,
      url: "https://github.com/acme/widget/pull/99"
    });
    expect(client.reads).toEqual(["src/greeting.ts"]);
    expect(client.opened).toMatchObject({
      branch: "oexl/dlv_abc",
      changes: [
        {
          path: "src/greeting.ts",
          kind: "modify",
          content: "export const greeting = 'Hi';\n"
        }
      ]
    });
    expect(client.comments[0]?.issueNumber).toBe(7);
    expect(client.comments[0]?.body).toContain("pull/99");
    expect(client.comments[0]?.body).toContain("/oexl accept dlv_abc");
  });

  it("skips a deliverable that is not GitHub-linked", async () => {
    const client = new FakeClient({});
    const publisher = new DeliverablePrPublisher(client, () =>
      Promise.resolve(null)
    );
    expect(await publisher.publish("dlv_x")).toEqual({
      kind: "skipped",
      reason: "deliverable is not GitHub-linked"
    });
    expect(client.comments).toHaveLength(0);
  });
});
