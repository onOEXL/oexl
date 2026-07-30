import { describe, expect, it } from "vitest";
import { finalizeEvent } from "nostr-tools/pure";
import {
  buzzPublicKey,
  createNip98Authorization,
  verifyNip98Authorization
} from "./auth.js";

const key = (): Uint8Array => {
  const value = new Uint8Array(32);
  value[31] = 1;
  return value;
};

describe("Buzz NIP-98 authentication", () => {
  it("binds the signer, method, URL, and exact payload", () => {
    const now = new Date("2026-07-25T12:00:00.000Z");
    const body = Buffer.from('{"hello":"buzz"}');
    const authorization = createNip98Authorization({
      privateKey: key(),
      method: "POST",
      url: "https://market.example/v1/auth/buzz/exchange",
      body,
      now,
      nonce: "test-nonce"
    });
    expect(
      verifyNip98Authorization({
        authorization,
        method: "POST",
        url: "https://market.example/v1/auth/buzz/exchange",
        body,
        now
      })
    ).toMatchObject({ pubkey: buzzPublicKey(key()) });
  });

  it("rejects replay against a different body or URL", () => {
    const now = new Date("2026-07-25T12:00:00.000Z");
    const authorization = createNip98Authorization({
      privateKey: key(),
      method: "POST",
      url: "https://market.example/v1/auth/buzz/exchange",
      body: Buffer.from("{}"),
      now,
      nonce: "test-nonce"
    });
    expect(() =>
      verifyNip98Authorization({
        authorization,
        method: "POST",
        url: "https://market.example/v1/auth/buzz/exchange",
        body: Buffer.from('{"changed":true}'),
        now
      })
    ).toThrow("invalid");
  });

  it("requires a bounded nonce in the signed event", () => {
    const now = new Date("2026-07-25T12:00:00.000Z");
    const url = "https://market.example/v1/auth/buzz/exchange";
    const body = Buffer.from("{}");
    const event = finalizeEvent(
      {
        kind: 27235,
        created_at: Math.floor(now.getTime() / 1_000),
        tags: [
          ["u", url],
          ["method", "POST"],
          [
            "payload",
            "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
          ]
        ],
        content: ""
      },
      key()
    );
    const authorization = `Nostr ${Buffer.from(JSON.stringify(event)).toString(
      "base64"
    )}`;
    expect(() =>
      verifyNip98Authorization({
        authorization,
        method: "POST",
        url,
        body,
        now
      })
    ).toThrow("invalid");
  });
});
