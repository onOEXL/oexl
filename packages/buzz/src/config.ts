import { z } from "zod";
import { buzzChannelTaskProfileSchema } from "./contract.js";

const bindingSchema = z.object({
  exchangeId: z.string().regex(/^exc_[A-Za-z0-9]+$/),
  relayUrl: z
    .string()
    .url()
    .regex(/^(?:https?|wss?):\/\//),
  webhookSecret: z.string().min(32).optional(),
  privateKey: z.string().min(1),
  channels: z.array(buzzChannelTaskProfileSchema).max(100).default([])
});

export type BuzzExchangeEnvironmentBinding = z.infer<typeof bindingSchema>;

const normalizeRelayUrl = (value: string): string =>
  value.replace(/\/+$/, "").replace(/^ws:/, "http:").replace(/^wss:/, "https:");

export const readBuzzExchangeEnvironment = (
  environment: Record<string, string | undefined>,
  options: {
    defaultExchangeId: string;
    requireWebhookSecret: boolean;
  }
): BuzzExchangeEnvironmentBinding[] => {
  const encoded = environment.OEXL_BUZZ_BINDINGS_JSON;
  const legacy = {
    relayUrl: environment.OEXL_BUZZ_OEXL_URL,
    webhookSecret: environment.OEXL_BUZZ_WEBHOOK_SECRET,
    privateKey: environment.OEXL_BUZZ_PRIVATE_KEY,
    exchangeId: environment.OEXL_BUZZ_EXCHANGE_ID ?? options.defaultExchangeId
  };
  const legacyCount = [
    legacy.relayUrl,
    legacy.webhookSecret,
    legacy.privateKey
  ].filter(Boolean).length;
  if (
    encoded &&
    (legacyCount > 0 || Boolean(environment.OEXL_BUZZ_EXCHANGE_ID))
  )
    throw new Error(
      "OEXL_BUZZ_BINDINGS_JSON cannot be combined with legacy Buzz environment variables"
    );

  let bindings: BuzzExchangeEnvironmentBinding[];
  if (encoded) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(encoded);
    } catch {
      throw new Error("OEXL_BUZZ_BINDINGS_JSON must be valid JSON");
    }
    bindings = z.array(bindingSchema).min(1).parse(decoded);
  } else if (legacyCount > 0) {
    const requiredCount = options.requireWebhookSecret ? 3 : 2;
    const configuredCount = options.requireWebhookSecret
      ? legacyCount
      : [legacy.relayUrl, legacy.privateKey].filter(Boolean).length;
    if (configuredCount !== requiredCount)
      throw new Error(
        options.requireWebhookSecret
          ? "OEXL_BUZZ_OEXL_URL, OEXL_BUZZ_WEBHOOK_SECRET, and OEXL_BUZZ_PRIVATE_KEY must be configured together"
          : "OEXL_BUZZ_OEXL_URL and OEXL_BUZZ_PRIVATE_KEY must be configured together for the control worker"
      );
    bindings = [
      bindingSchema.parse({
        exchangeId: legacy.exchangeId,
        relayUrl: legacy.relayUrl,
        ...(legacy.webhookSecret
          ? { webhookSecret: legacy.webhookSecret }
          : {}),
        privateKey: legacy.privateKey
      })
    ];
  } else {
    bindings = [];
  }

  const exchangeIds = new Set<string>();
  const relayUrls = new Set<string>();
  const channelIds = new Set<string>();
  for (const binding of bindings) {
    if (
      exchangeIds.has(binding.exchangeId) ||
      relayUrls.has(normalizeRelayUrl(binding.relayUrl))
    )
      throw new Error(
        "Buzz binding exchange identifiers and relay URLs must be unique"
      );
    if (options.requireWebhookSecret && !binding.webhookSecret)
      throw new Error("Every API Buzz binding requires a webhookSecret");
    exchangeIds.add(binding.exchangeId);
    relayUrls.add(normalizeRelayUrl(binding.relayUrl));
    for (const channel of binding.channels) {
      if (channelIds.has(channel.channelId))
        throw new Error(
          "Buzz channel task profiles must be unique across bindings"
        );
      channelIds.add(channel.channelId);
    }
  }
  return bindings;
};
