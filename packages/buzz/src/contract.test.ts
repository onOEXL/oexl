import { describe, expect, it } from "vitest";
import { parseBuzzTaskMessage } from "./contract.js";

describe("Buzz task contract", () => {
  it("parses the portable /bounty JSON envelope", () => {
    const parsed = parseBuzzTaskMessage(`/bounty
\`\`\`json
{
  "schemaVersion": "oexl.buzz-task.v1",
  "repository": {
    "cloneUrl": "https://github.com/alice/widget",
    "owner": "alice",
    "repoId": "widget",
    "baseSha": "${"b".repeat(40)}",
    "issueEventId": "${"c".repeat(64)}"
  },
  "outcome": "Add the missing warning",
  "acceptanceCriteria": ["The warning appears exactly once"],
  "reward": {"amountMinor": "100", "currency": "USD"},
  "allowedPaths": ["src/**"],
  "deadline": "2026-07-26T12:00:00.000Z"
}
\`\`\``);
    expect(parsed.repository.repoId).toBe("widget");
    expect(parsed.validation.method).toBe("buyer_review");
  });

  it("refuses ordinary chat messages", () => {
    expect(() => parseBuzzTaskMessage("please fix this")).toThrow("/bounty");
  });

  it("expands a compact channel bounty without floating-point money", () => {
    const parsed = parseBuzzTaskMessage(
      "/bounty $0.50 Add an Alpha staging proof marker",
      {
        channelId: "4cf8754b-3971-4c51-846c-2454e0aa9e22",
        repository: {
          cloneUrl: "https://github.com/tcballard/OEXL",
          owner: "tcballard",
          repoId: "tcballard/OEXL",
          baseSha: "a".repeat(40)
        },
        allowedPaths: ["docs/**"],
        acceptanceCriteria: ["The submitted patch satisfies: {{outcome}}"],
        validation: { method: "buyer_review", commands: [] },
        permittedExecutionModes: ["autonomous"],
        deadlineSeconds: 3_600
      },
      new Date("2026-07-28T08:00:00.000Z")
    );

    expect(parsed).toMatchObject({
      outcome: "Add an Alpha staging proof marker",
      reward: { amountMinor: "50", currency: "USD" },
      allowedPaths: ["docs/**"],
      acceptanceCriteria: [
        "The submitted patch satisfies: Add an Alpha staging proof marker"
      ],
      permittedExecutionModes: ["autonomous"],
      deadline: "2026-07-28T09:00:00.000Z"
    });
  });

  it("requires a channel profile for compact bounties", () => {
    expect(() => parseBuzzTaskMessage("/bounty $0.50 Add a marker")).toThrow(
      /not configured/
    );
  });
});
