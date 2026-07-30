import {
  buzzEventSchema,
  createNip98Authorization,
  signBuzzEvent
} from "./auth.js";
import type { Event, EventTemplate } from "nostr-tools/pure";
import { verifyEvent } from "nostr-tools/pure";
import { z } from "zod";

export interface BuzzEventPublisher {
  publish(template: EventTemplate): Promise<Event>;
}

export interface BuzzEventReader {
  query(filters: ReadonlyArray<Record<string, unknown>>): Promise<Event[]>;
}

const httpOrigin = (relayUrl: string): string => {
  const url = new URL(relayUrl);
  if (url.protocol === "wss:") url.protocol = "https:";
  else if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Buzz relay URL must use http(s) or ws(s)");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
};

const submitResponseSchema = z.object({
  event_id: z.string().regex(/^[0-9a-f]{64}$/),
  accepted: z.boolean(),
  message: z.string()
});

export class BuzzRelayHttpClient
  implements BuzzEventPublisher, BuzzEventReader
{
  private readonly origin: string;

  constructor(
    relayUrl: string,
    private readonly privateKey: Uint8Array,
    private readonly request: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.origin = httpOrigin(relayUrl);
  }

  async publish(template: EventTemplate): Promise<Event> {
    const event = signBuzzEvent(template, this.privateKey);
    const body = Buffer.from(JSON.stringify(event), "utf8");
    const url = `${this.origin}/events`;
    const response = await this.request(url, {
      method: "POST",
      headers: {
        authorization: createNip98Authorization({
          privateKey: this.privateKey,
          method: "POST",
          url,
          body,
          now: this.clock()
        }),
        "content-type": "application/json",
        "user-agent": "oexl-buzz-bridge/0.1"
      },
      body
    });
    if (!response.ok)
      throw Object.assign(
        new Error(`Buzz relay rejected event with HTTP ${response.status}`),
        { code: "OEXL_BUZZ_PUBLISH_FAILED" }
      );
    let result: z.infer<typeof submitResponseSchema>;
    try {
      result = submitResponseSchema.parse(await response.json());
    } catch {
      throw Object.assign(
        new Error("Buzz relay returned an invalid event receipt"),
        { code: "OEXL_BUZZ_PUBLISH_FAILED" }
      );
    }
    if (!result.accepted || result.event_id !== event.id)
      throw Object.assign(new Error("Buzz relay did not accept the event"), {
        code: "OEXL_BUZZ_PUBLISH_FAILED"
      });
    return event;
  }

  async query(
    filters: ReadonlyArray<Record<string, unknown>>
  ): Promise<Event[]> {
    const body = Buffer.from(JSON.stringify(filters), "utf8");
    const url = `${this.origin}/query`;
    const response = await this.request(url, {
      method: "POST",
      headers: {
        authorization: createNip98Authorization({
          privateKey: this.privateKey,
          method: "POST",
          url,
          body,
          now: this.clock()
        }),
        "content-type": "application/json",
        "user-agent": "oexl-buzz-bridge/0.1"
      },
      body
    });
    if (!response.ok)
      throw Object.assign(
        new Error(`Buzz relay query failed with HTTP ${response.status}`),
        { code: "OEXL_BUZZ_QUERY_FAILED" }
      );
    try {
      const events = z.array(buzzEventSchema).parse(await response.json());
      if (!events.every((event) => verifyEvent(event)))
        throw new Error("invalid event signature");
      return events;
    } catch {
      throw Object.assign(
        new Error("Buzz relay returned invalid signed events"),
        { code: "OEXL_BUZZ_QUERY_FAILED" }
      );
    }
  }
}
