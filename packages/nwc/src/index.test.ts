import { describe, expect, it } from "vitest";
import { FakeNwcClient, parseNwcUri } from "./index.js";

describe("NWC client", () => {
  it("parses a scoped NIP-47 connection URI", () => {
    const parsed = parseNwcUri(
      `nostr+walletconnect://${"a".repeat(64)}` +
        `?relay=${encodeURIComponent("wss://relay.example")}` +
        `&secret=${"b".repeat(64)}`
    );
    expect(parsed.walletServicePubkey).toBe("a".repeat(64));
    expect(parsed.relayUrls).toEqual(["wss://relay.example/"]);
    expect(parsed.clientSecret).toHaveLength(32);
  });

  it("supports a deterministic closed-loop invoice lifecycle", async () => {
    const client = new FakeNwcClient();
    const invoice = await client.makeInvoice({
      amountMsats: 21_000n,
      description: "OEXL settlement",
      expirySeconds: 300
    });
    const paid = await client.payInvoice(invoice.invoice);
    const verified = await client.lookupInvoice({
      paymentHash: invoice.paymentHash
    });
    expect(paid.paymentHash).toBe(invoice.paymentHash);
    expect(verified.state).toBe("settled");
    expect(verified.amountMsats).toBe(21_000n);
  });
});
