import type { GithubRepoClient } from "./client.js";
import { basePathsNeeded, planChangesFromDiff } from "./patch.js";

// Everything needed to turn one submitted deliverable into a pull request. The
// publisher stays store-agnostic: the host injects this context loader.
export type DeliverablePrContext = {
  installationId: number;
  owner: string;
  repo: string;
  issueNumber: number;
  baseSha: string;
  patch: string;
  deliverableId: string;
};

export type PrPublishResult =
  | { kind: "skipped"; reason: string }
  | { kind: "opened"; prNumber: number; url: string };

// Opens a pull request on the buyer's repo for a submitted deliverable and links
// it back on the originating issue. Reads base file contents, applies the patch
// to build the branch, opens the PR, and comments — never merges.
export class DeliverablePrPublisher {
  constructor(
    private readonly client: GithubRepoClient,
    private readonly loadContext: (
      deliverableId: string
    ) => Promise<DeliverablePrContext | null>
  ) {}

  async publish(deliverableId: string): Promise<PrPublishResult> {
    const context = await this.loadContext(deliverableId);
    if (!context)
      return { kind: "skipped", reason: "deliverable is not GitHub-linked" };

    const target = {
      installationId: context.installationId,
      owner: context.owner,
      repo: context.repo
    };
    const baseContent = new Map<string, string | null>();
    for (const path of basePathsNeeded(context.patch))
      baseContent.set(
        path,
        await this.client.readFile(target, context.baseSha, path)
      );
    const changes = planChangesFromDiff(
      context.patch,
      (path) => baseContent.get(path) ?? null
    );

    const branch = `oexl/${context.deliverableId}`;
    const title = `OEXL deliverable ${context.deliverableId}`;
    const body = [
      `Deliverable \`${context.deliverableId}\` for issue #${context.issueNumber}.`,
      "",
      "Review the diff. To settle, comment on the issue:",
      "",
      `> /oexl accept ${context.deliverableId}`,
      "",
      "Merging this pull request applies the work; OEXL never merges for you."
    ].join("\n");

    const pr = await this.client.openPullRequest(target, {
      baseSha: context.baseSha,
      branch,
      title,
      body,
      changes
    });
    await this.client.commentIssue(
      target,
      context.issueNumber,
      `Deliverable \`${context.deliverableId}\` is ready for review in #${pr.number}: ${pr.url}\n\nComment \`/oexl accept ${context.deliverableId}\` to settle, or \`/oexl reject ${context.deliverableId}\`.`
    );
    return { kind: "opened", prNumber: pr.number, url: pr.url };
  }
}
