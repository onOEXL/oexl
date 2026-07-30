import type { EventTemplate } from "nostr-tools/pure";
import type { BuzzEventPublisher } from "./client.js";
import type { BuzzPaymentRequest } from "./contract.js";

export type BuzzDeliverableContext = {
  exchangeId: string;
  relayUrl: string;
  channelId: string;
  sourceEventId: string;
  buyerPubkey: string;
  repositoryUrl: string;
  baseSha: string;
  patch: string;
  patchSha256: string;
  deliverableId: string;
};

export type BuzzPublishResult =
  | { kind: "skipped"; reason: string }
  | { kind: "published"; eventId: string; eventKind: 9 };

const eventTemplate = (
  context: BuzzDeliverableContext,
  now: Date
): EventTemplate => {
  const commonTags = [
    ["h", context.channelId],
    ["e", context.sourceEventId, "", "reply"],
    ["p", context.buyerPubkey],
    ["t", "oexl"],
    ["oexl-deliverable", context.deliverableId],
    ["sha256", context.patchSha256]
  ];
  return {
    kind: 9,
    created_at: Math.floor(now.getTime() / 1_000),
    tags: [
      ...commonTags,
      ["repo", context.repositoryUrl],
      ["commit", context.baseSha],
      ["alt", `OEXL deliverable ${context.deliverableId} is ready`]
    ],
    content:
      `Deliverable ready · \`${context.deliverableId}\`\n` +
      `Review in OEXL · SHA-256 \`${context.patchSha256}\`\n` +
      `React ✅ to approve or ❌ to reject.`
  };
};

export class BuzzDeliverablePublisher {
  constructor(
    private readonly clientForRelay: (
      relayUrl: string,
      exchangeId: string
    ) => BuzzEventPublisher,
    private readonly loadContext: (
      deliverableId: string
    ) => Promise<BuzzDeliverableContext | null>,
    private readonly recordPublished: (
      deliverableId: string,
      eventId: string,
      eventKind: number
    ) => Promise<void>,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async publish(deliverableId: string): Promise<BuzzPublishResult> {
    const context = await this.loadContext(deliverableId);
    if (!context)
      return { kind: "skipped", reason: "deliverable is not Buzz-linked" };
    const template = eventTemplate(context, this.clock());
    const event = await this.clientForRelay(
      context.relayUrl,
      context.exchangeId
    ).publish(template);
    await this.recordPublished(deliverableId, event.id, event.kind);
    return {
      kind: "published",
      eventId: event.id,
      eventKind: event.kind as 9
    };
  }
}

export type BuzzPaymentContext = {
  exchangeId: string;
  relayUrl: string;
  channelId: string;
  buyerPubkey: string;
  request: BuzzPaymentRequest;
};

export type BuzzLifecycleStage =
  "task_created" | "provider_matched" | "completed" | "rejected";

export type BuzzLifecycleContext = {
  stage: BuzzLifecycleStage;
  taskId: string;
  exchangeId: string;
  relayUrl: string;
  channelId: string;
  sourceEventId: string;
  buyerPubkey: string;
  outcome: string;
  maximumRewardMinor: string;
  agreedRewardMinor?: string;
  returnedMinor?: string;
  workerAlias?: string;
};

const usd = (minor: string): string => {
  const value = BigInt(minor);
  return `$${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
};

const lifecycleContent = (context: BuzzLifecycleContext): string => {
  if (context.stage === "task_created")
    return (
      `Task funded · ${usd(context.maximumRewardMinor)}\n` +
      `${context.outcome}\n` +
      `Status · Finding a provider`
    );
  if (context.stage === "provider_matched")
    return (
      `Provider matched · ${context.workerAlias ?? "OEXL provider"}\n` +
      `Agreed reward · ${usd(
        context.agreedRewardMinor ?? context.maximumRewardMinor
      )}\n` +
      `Status · Work in progress`
    );
  if (context.stage === "completed")
    return (
      `Complete · Deliverable accepted\n` +
      `${usd(
        context.agreedRewardMinor ?? context.maximumRewardMinor
      )} pending provider payout\n` +
      `${usd(context.returnedMinor ?? "0")} returned to the buyer`
    );
  return (
    `Changes requested · ${context.taskId}\n` +
    `The reward reservation has been returned to the buyer`
  );
};

export class BuzzLifecyclePublisher {
  constructor(
    private readonly clientForRelay: (
      relayUrl: string,
      exchangeId: string
    ) => BuzzEventPublisher,
    private readonly loadContext: (
      stage: BuzzLifecycleStage,
      aggregateId: string
    ) => Promise<BuzzLifecycleContext | null>,
    private readonly recordPublished: (
      taskId: string,
      stage: BuzzLifecycleStage,
      eventId: string,
      exchangeId: string
    ) => Promise<void>,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async publish(
    stage: BuzzLifecycleStage,
    aggregateId: string
  ): Promise<BuzzPublishResult> {
    const context = await this.loadContext(stage, aggregateId);
    if (!context) return { kind: "skipped", reason: "task is not Buzz-linked" };
    const event = await this.clientForRelay(
      context.relayUrl,
      context.exchangeId
    ).publish({
      kind: 9,
      created_at: Math.floor(this.clock().getTime() / 1_000),
      tags: [
        ["h", context.channelId],
        ["e", context.sourceEventId, "", "reply"],
        ["p", context.buyerPubkey],
        ["t", "oexl"],
        ["oexl-task", context.taskId],
        ["oexl-stage", context.stage],
        ["alt", `OEXL task ${context.stage.replaceAll("_", " ")}`]
      ],
      content: lifecycleContent(context)
    });
    await this.recordPublished(
      context.taskId,
      context.stage,
      event.id,
      context.exchangeId
    );
    return { kind: "published", eventId: event.id, eventKind: 9 };
  }
}

export const buzzPaymentEventTemplate = (
  context: BuzzPaymentContext,
  now: Date = new Date()
): EventTemplate => ({
  kind: 40009,
  created_at: Math.floor(now.getTime() / 1_000),
  tags: [
    ["h", context.channelId],
    ["p", context.buyerPubkey],
    ["t", "oexl"],
    ["oexl-settlement", context.request.settlementId],
    ["oexl-deliverable", context.request.deliverableId],
    ["payment-hash", context.request.paymentHash],
    ["amount-msats", context.request.amountMsats],
    ["expires", context.request.expiresAt],
    ["alt", `Lightning payment request for ${context.request.deliverableId}`]
  ],
  content: JSON.stringify(context.request)
});
