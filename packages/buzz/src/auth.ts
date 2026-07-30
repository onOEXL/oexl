import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { nip19 } from "nostr-tools";
import {
  finalizeEvent,
  getPublicKey,
  verifyEvent,
  type Event,
  type EventTemplate
} from "nostr-tools/pure";
import { z } from "zod";

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const hex128 = z.string().regex(/^[0-9a-f]{128}$/);

export const buzzEventSchema = z.object({
  id: hex64,
  pubkey: hex64,
  created_at: z.number().int().nonnegative(),
  kind: z.number().int().nonnegative(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: hex128
});

export const readBuzzPrivateKey = (value: string): Uint8Array => {
  const trimmed = value.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed))
    return Uint8Array.from(Buffer.from(trimmed, "hex"));
  if (trimmed.startsWith("nsec1")) {
    const decoded = nip19.decode(trimmed);
    if (decoded.type === "nsec") return decoded.data;
  }
  throw Object.assign(
    new Error("BUZZ_PRIVATE_KEY must be a 64-character hex key or nsec"),
    { code: "OEXL_AUTH_BUZZ_KEY_INVALID" }
  );
};

export const buzzPublicKey = (privateKey: Uint8Array): string =>
  getPublicKey(privateKey);

const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const singleTag = (event: Event, name: string): string | undefined => {
  const values = event.tags.filter((tag) => tag[0] === name);
  if (values.length !== 1 || values[0]!.length !== 2) return undefined;
  return values[0]![1];
};

const sameText = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export type Nip98Verification = {
  eventId: string;
  pubkey: string;
  createdAt: number;
};

export const createNip98Authorization = (input: {
  privateKey: Uint8Array;
  method: string;
  url: string;
  body?: Uint8Array;
  now?: Date;
  nonce?: string;
}): string => {
  const tags = [
    ["u", input.url],
    ["method", input.method.toUpperCase()],
    ["nonce", input.nonce ?? randomUUID()]
  ];
  if (input.body) tags.push(["payload", sha256(input.body)]);
  const event = finalizeEvent(
    {
      kind: 27235,
      created_at: Math.floor((input.now ?? new Date()).getTime() / 1_000),
      tags,
      content: ""
    },
    input.privateKey
  );
  return `Nostr ${Buffer.from(JSON.stringify(event), "utf8").toString(
    "base64"
  )}`;
};

export const verifyNip98Authorization = (input: {
  authorization?: string;
  method: string;
  url: string;
  body?: Uint8Array;
  now?: Date;
  maximumSkewSeconds?: number;
}): Nip98Verification => {
  const match = /^Nostr ([A-Za-z0-9+/]+={0,2})$/.exec(
    input.authorization ?? ""
  );
  if (!match)
    throw Object.assign(new Error("Buzz NIP-98 authorization is required"), {
      code: "OEXL_AUTH_BUZZ_INVALID"
    });
  let event: Event;
  try {
    const decoded = Buffer.from(match[1]!, "base64").toString("utf8");
    event = buzzEventSchema.parse(JSON.parse(decoded));
  } catch {
    throw Object.assign(new Error("Buzz NIP-98 event is malformed"), {
      code: "OEXL_AUTH_BUZZ_INVALID"
    });
  }
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
  const maximumSkew = input.maximumSkewSeconds ?? 60;
  const expectedPayload = input.body ? sha256(input.body) : undefined;
  const nonce = singleTag(event, "nonce");
  const valid =
    event.kind === 27235 &&
    event.content === "" &&
    verifyEvent(event) &&
    Math.abs(nowSeconds - event.created_at) <= maximumSkew &&
    typeof nonce === "string" &&
    nonce.length > 0 &&
    nonce.length <= 200 &&
    singleTag(event, "u") === input.url &&
    singleTag(event, "method") === input.method.toUpperCase() &&
    (expectedPayload === undefined
      ? singleTag(event, "payload") === undefined
      : sameText(singleTag(event, "payload") ?? "", expectedPayload));
  if (!valid)
    throw Object.assign(
      new Error("Buzz NIP-98 signature or request binding is invalid"),
      { code: "OEXL_AUTH_BUZZ_INVALID" }
    );
  return {
    eventId: event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at
  };
};

export const signBuzzEvent = (
  template: EventTemplate,
  privateKey: Uint8Array
): Event => finalizeEvent(template, privateKey);
