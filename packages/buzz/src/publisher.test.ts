import { describe, expect, it, vi } from "vitest";
import { finalizeEvent, type EventTemplate } from "nostr-tools/pure";
import {
  BuzzDeliverablePublisher,
  BuzzLifecyclePublisher,
  buzzPaymentEventTemplate
} from "./publisher.js";

const secret = new Uint8Array(32).fill(1);

describe("Buzz deliverable publisher", () => {
  it("publishes a concise review message tied to the original task", async () => {
    let published: EventTemplate | undefined;
    const record = vi.fn(() => Promise.resolve());
    const clientForRelay = vi.fn(() => ({
      publish: (template: EventTemplate) => {
        published = template;
        return Promise.resolve(finalizeEvent(template, secret));
      }
    }));
    const publisher = new BuzzDeliverablePublisher(
      clientForRelay,
      () =>
        Promise.resolve({
          exchangeId: "exc_local",
          relayUrl: "https://buzz.example",
          channelId: "4cf8754b-3971-4c51-846c-2454e0aa9e22",
          sourceEventId: "a".repeat(64),
          buyerPubkey: "b".repeat(64),
          repositoryUrl: "https://buzz.example/git/alice/widget",
          baseSha: "c".repeat(40),
          patch:
            "diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-old\n+new\n",
          patchSha256: "d".repeat(64),
          deliverableId: "dlv_example"
        }),
      record,
      () => new Date("2026-07-25T12:00:00.000Z")
    );

    const result = await publisher.publish("dlv_example");
    expect(result.kind).toBe("published");
    expect(published?.kind).toBe(9);
    expect(published?.tags).toContainEqual(["oexl-deliverable", "dlv_example"]);
    expect(published?.content).toContain("Deliverable ready");
    expect(published?.content).toContain("React ✅ to approve");
    expect(published?.content).not.toContain("diff --git");
    expect(clientForRelay).toHaveBeenCalledWith(
      "https://buzz.example",
      "exc_local"
    );
    expect(record).toHaveBeenCalledOnce();
  });
});

describe("Buzz lifecycle publisher", () => {
  it.each([
    ["task_created", "Task funded · $0.50"],
    ["provider_matched", "Provider matched · Alpha Provider"],
    ["completed", "$0.40 pending provider payout"],
    ["rejected", "Changes requested · tsk_example"]
  ] as const)("publishes a concise %s card", async (stage, expected) => {
    let published: EventTemplate | undefined;
    const record = vi.fn(() => Promise.resolve());
    const publisher = new BuzzLifecyclePublisher(
      () => ({
        publish: (template: EventTemplate) => {
          published = template;
          return Promise.resolve(finalizeEvent(template, secret));
        }
      }),
      () =>
        Promise.resolve({
          stage,
          taskId: "tsk_example",
          exchangeId: "exc_alpha",
          relayUrl: "https://buzz.example",
          channelId: "4cf8754b-3971-4c51-846c-2454e0aa9e22",
          sourceEventId: "a".repeat(64),
          buyerPubkey: "b".repeat(64),
          outcome: "Add the proof marker",
          maximumRewardMinor: "50",
          agreedRewardMinor: "40",
          returnedMinor: "10",
          workerAlias: "Alpha Provider"
        }),
      record,
      () => new Date("2026-07-28T12:00:00.000Z")
    );

    await expect(publisher.publish(stage, "aggregate")).resolves.toMatchObject({
      kind: "published",
      eventKind: 9
    });
    expect(published?.kind).toBe(9);
    expect(published?.content).toContain(expected);
    expect(published?.tags).toContainEqual(["oexl-stage", stage]);
    expect(record).toHaveBeenCalledWith(
      "tsk_example",
      stage,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      "exc_alpha"
    );
  });
});

describe("Buzz payment request publisher", () => {
  it("publishes a versioned, exact-msat compatibility contract", () => {
    const template = buzzPaymentEventTemplate(
      {
        exchangeId: "exc_test",
        relayUrl: "wss://buzz.example",
        channelId: "16e24f30-5d95-4aa5-a90a-7d5741f7ab34",
        buyerPubkey: "b".repeat(64),
        request: {
          schemaVersion: "oexl.buzz-payment-request.v1",
          settlementId: "xst_payment1",
          deliverableId: "dlv_result1",
          invoice: "lnbc-test-invoice-123456789",
          paymentHash: "a".repeat(64),
          amountMsats: "21001",
          pricingBasis: "explicit_msats",
          expiresAt: "2026-07-28T12:00:00.000Z"
        }
      },
      new Date("2026-07-27T12:00:00.000Z")
    );
    expect(template.kind).toBe(40009);
    expect(template.tags).toContainEqual(["amount-msats", "21001"]);
    expect(JSON.parse(template.content)).toMatchObject({
      schemaVersion: "oexl.buzz-payment-request.v1",
      pricingBasis: "explicit_msats"
    });
  });
});
