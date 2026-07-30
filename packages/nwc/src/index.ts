import { randomBytes } from "node:crypto";
import { Relay } from "nostr-tools/relay";
import { finalizeEvent, getPublicKey, type Event } from "nostr-tools/pure";
import { nip44 } from "nostr-tools";
import { z } from "zod";

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const msats = z.number().int().nonnegative().safe();

export type NwcConnection = {
  walletServicePubkey: string;
  relayUrls: string[];
  clientSecret: Uint8Array;
};

export const parseNwcUri = (value: string): NwcConnection => {
  const url = new URL(value);
  if (url.protocol !== "nostr+walletconnect:")
    throw new Error("NWC URI must use nostr+walletconnect://");
  const walletServicePubkey = hex64.parse(
    url.hostname || url.pathname.slice(2)
  );
  const relayUrls = url.searchParams
    .getAll("relay")
    .map((relay) => new URL(relay).toString());
  if (!relayUrls.length || relayUrls.some((relay) => !/^wss?:\/\//.test(relay)))
    throw new Error("NWC URI must include at least one WebSocket relay");
  const secret = hex64.parse(url.searchParams.get("secret"));
  return {
    walletServicePubkey,
    relayUrls: [...new Set(relayUrls)],
    clientSecret: Uint8Array.from(Buffer.from(secret, "hex"))
  };
};

export type NwcInvoice = {
  invoice: string;
  paymentHash: string;
  amountMsats: bigint;
  expiresAt?: string | undefined;
  settledAt?: string | undefined;
  state: "pending" | "settled" | "expired" | "failed";
};

export type NwcPayResult = {
  paymentHash: string;
  preimage: string;
  feesPaidMsats: bigint;
};

export interface NwcClient {
  getInfo(): Promise<{ methods: string[] }>;
  makeInvoice(input: {
    amountMsats: bigint;
    description: string;
    expirySeconds: number;
  }): Promise<NwcInvoice>;
  lookupInvoice(input: {
    paymentHash?: string;
    invoice?: string;
  }): Promise<NwcInvoice>;
  payInvoice(invoice: string): Promise<NwcPayResult>;
  close(): void;
}

type NwcResult = {
  result_type: string;
  result?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};

const toSafeNumber = (value: bigint): number => {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("NWC amount exceeds the safe integer transport range");
  return Number(value);
};

export class NostrWalletConnectClient implements NwcClient {
  private relay: Relay | undefined;
  private readonly conversationKey: Uint8Array;
  private readonly clientPubkey: string;

  constructor(
    private readonly connection: NwcConnection,
    private readonly timeoutMs = 15_000
  ) {
    this.clientPubkey = getPublicKey(connection.clientSecret);
    this.conversationKey = nip44.v2.utils.getConversationKey(
      connection.clientSecret,
      connection.walletServicePubkey
    );
  }

  async getInfo(): Promise<{ methods: string[] }> {
    const relay = await this.connectedRelay();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        subscription.close();
        reject(new Error("NWC get_info timed out"));
      }, this.timeoutMs);
      const subscription = relay.subscribe(
        [
          {
            kinds: [13194],
            authors: [this.connection.walletServicePubkey],
            limit: 1
          }
        ],
        {
          onevent: (event) => {
            clearTimeout(timer);
            subscription.close();
            resolve({
              methods: event.content.split(/\s+/).filter(Boolean)
            });
          }
        }
      );
    });
  }

  async makeInvoice(input: {
    amountMsats: bigint;
    description: string;
    expirySeconds: number;
  }): Promise<NwcInvoice> {
    const result = await this.request("make_invoice", {
      amount: toSafeNumber(input.amountMsats),
      description: input.description,
      expiry: input.expirySeconds
    });
    return parseInvoice(result);
  }

  async lookupInvoice(input: {
    paymentHash?: string;
    invoice?: string;
  }): Promise<NwcInvoice> {
    return parseInvoice(await this.request("lookup_invoice", input));
  }

  async payInvoice(invoice: string): Promise<NwcPayResult> {
    const result = await this.request("pay_invoice", { invoice });
    return {
      paymentHash: hex64.parse(result.payment_hash),
      preimage: hex64.parse(result.preimage),
      feesPaidMsats: BigInt(msats.parse(result.fees_paid))
    };
  }

  close(): void {
    this.relay?.close();
    this.relay = undefined;
  }

  private async connectedRelay(): Promise<Relay> {
    if (this.relay?.connected) return this.relay;
    let lastError: unknown;
    for (const relayUrl of this.connection.relayUrls)
      try {
        this.relay = await Relay.connect(relayUrl, {
          enableReconnect: false
        });
        return this.relay;
      } catch (cause) {
        lastError = cause;
      }
    throw new Error("No NWC relay connection succeeded", { cause: lastError });
  }

  private async request(
    method: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const relay = await this.connectedRelay();
    const content = nip44.v2.encrypt(
      JSON.stringify({ method, params }),
      this.conversationKey,
      randomBytes(32)
    );
    const request = finalizeEvent(
      {
        kind: 23194,
        created_at: Math.floor(Date.now() / 1_000),
        tags: [["p", this.connection.walletServicePubkey]],
        content
      },
      this.connection.clientSecret
    );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        subscription.close();
        reject(new Error(`NWC ${method} timed out`));
      }, this.timeoutMs);
      const finish = (
        error: Error | undefined,
        value?: Record<string, unknown>
      ) => {
        clearTimeout(timer);
        subscription.close();
        if (error) reject(error);
        else resolve(value ?? {});
      };
      const subscription = relay.subscribe(
        [
          {
            kinds: [23195],
            authors: [this.connection.walletServicePubkey],
            "#p": [this.clientPubkey],
            "#e": [request.id]
          }
        ],
        {
          onevent: (event: Event) => {
            try {
              if (Buffer.byteLength(event.content, "utf8") > 100_000)
                throw new Error("NWC response exceeds the safe payload limit");
              const response = JSON.parse(
                nip44.v2.decrypt(event.content, this.conversationKey)
              ) as NwcResult;
              if (response.result_type !== method)
                throw new Error("NWC response method does not match request");
              if (response.error)
                throw Object.assign(
                  new Error(response.error.message ?? "NWC request failed"),
                  { code: response.error.code ?? "NWC_ERROR" }
                );
              finish(undefined, response.result ?? {});
            } catch (cause) {
              finish(
                cause instanceof Error
                  ? cause
                  : new Error("Invalid NWC response")
              );
            }
          }
        }
      );
      relay.publish(request).catch((cause) => {
        finish(
          cause instanceof Error ? cause : new Error("NWC publish failed")
        );
      });
    });
  }
}

const parseInvoice = (value: Record<string, unknown>): NwcInvoice => {
  const settledAt =
    typeof value.settled_at === "number"
      ? new Date(value.settled_at * 1_000).toISOString()
      : undefined;
  const expiresAt =
    typeof value.expires_at === "number"
      ? new Date(value.expires_at * 1_000).toISOString()
      : undefined;
  return {
    invoice: z.string().min(20).parse(value.invoice),
    paymentHash: hex64.parse(value.payment_hash),
    amountMsats: BigInt(msats.parse(value.amount)),
    expiresAt,
    settledAt,
    state: settledAt
      ? "settled"
      : expiresAt && new Date(expiresAt) <= new Date()
        ? "expired"
        : "pending"
  };
};

export class FakeNwcClient implements NwcClient {
  private readonly invoices = new Map<string, NwcInvoice>();

  getInfo(): Promise<{ methods: string[] }> {
    return Promise.resolve({
      methods: ["make_invoice", "lookup_invoice", "pay_invoice"]
    });
  }

  makeInvoice(input: {
    amountMsats: bigint;
    description: string;
    expirySeconds: number;
  }): Promise<NwcInvoice> {
    const paymentHash = Buffer.from(
      `${input.description}:${input.amountMsats}:${this.invoices.size}`
    )
      .toString("hex")
      .padEnd(64, "0")
      .slice(0, 64);
    const invoice: NwcInvoice = {
      invoice: `lnbc-test-${paymentHash}`,
      paymentHash,
      amountMsats: input.amountMsats,
      expiresAt: new Date(
        Date.now() + input.expirySeconds * 1_000
      ).toISOString(),
      state: "pending"
    };
    this.invoices.set(paymentHash, invoice);
    return Promise.resolve(invoice);
  }

  lookupInvoice(input: {
    paymentHash?: string;
    invoice?: string;
  }): Promise<NwcInvoice> {
    const invoice = input.paymentHash
      ? this.invoices.get(input.paymentHash)
      : [...this.invoices.values()].find(
          (item) => item.invoice === input.invoice
        );
    if (!invoice) return Promise.reject(new Error("Invoice not found"));
    return Promise.resolve(invoice);
  }

  payInvoice(invoice: string): Promise<NwcPayResult> {
    const found = [...this.invoices.values()].find(
      (item) => item.invoice === invoice
    );
    if (!found) return Promise.reject(new Error("Invoice not found"));
    found.state = "settled";
    found.settledAt = new Date().toISOString();
    return Promise.resolve({
      paymentHash: found.paymentHash,
      preimage: "f".repeat(64),
      feesPaidMsats: 0n
    });
  }

  close(): void {}
}
