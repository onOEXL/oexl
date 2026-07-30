import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { signBuzzEvent, verifyNip98Authorization } from "./auth.js";
import { BuzzRelayHttpClient } from "./client.js";

const privateKey = new Uint8Array(32).fill(3);
const clock = () => new Date("2026-07-25T12:00:00.000Z");
const eventBodySchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/),
  pubkey: z.string().regex(/^[0-9a-f]{64}$/)
});
const requestUrl = (input: string | URL | Request): string =>
  typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

describe("BuzzRelayHttpClient", () => {
  it("binds NIP-98 to the exact event body and verifies the receipt", async () => {
    const request = vi.fn<typeof fetch>((input, init) => {
      const body = Buffer.from(init?.body as Uint8Array);
      const event = eventBodySchema.parse(JSON.parse(body.toString("utf8")));
      expect(requestUrl(input)).toBe("https://buzz.example/community/events");
      const authorization = new Headers(init?.headers).get("authorization");
      expect(
        verifyNip98Authorization({
          ...(authorization ? { authorization } : {}),
          method: "POST",
          url: requestUrl(input),
          body,
          now: clock()
        })
      ).toMatchObject({ pubkey: event.pubkey });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            event_id: event.id,
            accepted: true,
            message: ""
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    });
    const client = new BuzzRelayHttpClient(
      "wss://buzz.example/community",
      privateKey,
      request,
      clock
    );

    await expect(
      client.publish({
        kind: 9,
        created_at: Math.floor(clock().getTime() / 1_000),
        tags: [["h", "4cf8754b-3971-4c51-846c-2454e0aa9e22"]],
        content: "hello"
      })
    ).resolves.toMatchObject({ kind: 9 });
    expect(request).toHaveBeenCalledOnce();
  });

  it("does not record a 200 response whose receipt rejects the event", async () => {
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            event_id: "a".repeat(64),
            accepted: false,
            message: "rejected"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    const client = new BuzzRelayHttpClient(
      "https://buzz.example",
      privateKey,
      request,
      clock
    );
    await expect(
      client.publish({
        kind: 9,
        created_at: Math.floor(clock().getTime() / 1_000),
        tags: [],
        content: "hello"
      })
    ).rejects.toMatchObject({ code: "OEXL_BUZZ_PUBLISH_FAILED" });
  });

  it("binds relay queries to NIP-98 and accepts only signed events", async () => {
    const event = signBuzzEvent(
      {
        kind: 9,
        created_at: Math.floor(clock().getTime() / 1_000),
        tags: [["h", "4cf8754b-3971-4c51-846c-2454e0aa9e22"]],
        content: "verified"
      },
      privateKey
    );
    const request = vi.fn<typeof fetch>((input, init) => {
      const body = Buffer.from(init?.body as Uint8Array);
      const authorization = new Headers(init?.headers).get("authorization");
      expect(
        verifyNip98Authorization({
          ...(authorization ? { authorization } : {}),
          method: "POST",
          url: requestUrl(input),
          body,
          now: clock()
        })
      ).toMatchObject({ pubkey: event.pubkey });
      return Promise.resolve(
        new Response(JSON.stringify([event]), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );
    });
    const client = new BuzzRelayHttpClient(
      "https://buzz.example",
      privateKey,
      request,
      clock
    );
    await expect(
      client.query([{ ids: [event.id], kinds: [9] }])
    ).resolves.toEqual([event]);
  });

  it("rejects a relay query response with a tampered event", async () => {
    const event = signBuzzEvent(
      {
        kind: 9,
        created_at: Math.floor(clock().getTime() / 1_000),
        tags: [],
        content: "original"
      },
      privateKey
    );
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ ...event, content: "tampered" }]), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
    const client = new BuzzRelayHttpClient(
      "https://buzz.example",
      privateKey,
      request,
      clock
    );
    await expect(client.query([{ ids: [event.id] }])).rejects.toMatchObject({
      code: "OEXL_BUZZ_QUERY_FAILED"
    });
  });
});
