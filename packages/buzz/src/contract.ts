import { z } from "zod";

export const buzzHexId = z.string().regex(/^[0-9a-f]{64}$/);

const rewardSchema = z.object({
  amountMinor: z.string().regex(/^[1-9][0-9]*$/),
  currency: z.literal("USD")
});

export const buzzTaskCommandSchema = z.object({
  schemaVersion: z.literal("oexl.buzz-task.v1"),
  repository: z.object({
    cloneUrl: z
      .string()
      .url()
      .regex(/^https:\/\/github\.com\//),
    owner: z.string().trim().min(1).max(100),
    repoId: z.string().trim().min(1).max(200),
    baseSha: z.string().regex(/^[0-9a-f]{40}$/),
    issueEventId: buzzHexId.optional()
  }),
  outcome: z.string().trim().min(1).max(8_000),
  acceptanceCriteria: z
    .array(z.string().trim().min(1).max(1_000))
    .min(1)
    .max(20),
  reward: rewardSchema,
  allowedPaths: z.array(z.string().min(1)).min(1).max(50),
  validation: z
    .object({
      method: z
        .enum(["mechanical_patch", "buyer_review", "declared_command"])
        .default("buyer_review"),
      commands: z.array(z.string().min(1).max(2_000)).max(10).default([])
    })
    .default({}),
  permittedExecutionModes: z
    .array(z.enum(["human_supervised", "autonomous"]))
    .min(1)
    .max(2)
    .default(["human_supervised", "autonomous"]),
  deadline: z.string().datetime()
});

export type BuzzTaskCommand = z.infer<typeof buzzTaskCommandSchema>;

export const buzzChannelTaskProfileSchema = z.object({
  channelId: z.string().uuid(),
  repository: buzzTaskCommandSchema.shape.repository.omit({
    issueEventId: true
  }),
  allowedPaths: buzzTaskCommandSchema.shape.allowedPaths,
  acceptanceCriteria: buzzTaskCommandSchema.shape.acceptanceCriteria,
  validation: buzzTaskCommandSchema.shape.validation,
  permittedExecutionModes: buzzTaskCommandSchema.shape.permittedExecutionModes,
  deadlineSeconds: z.number().int().min(300).max(604_800).default(86_400)
});
export type BuzzChannelTaskProfile = z.infer<
  typeof buzzChannelTaskProfileSchema
>;

const compactRewardMinor = (value: string): string => {
  const match = value.match(/^\$?([0-9]+)(?:\.([0-9]{1,2}))?$/);
  if (!match)
    throw Object.assign(
      new Error("Compact Buzz bounty reward must be USD, for example $0.50"),
      { code: "OEXL_BUZZ_TASK_INVALID" }
    );
  const major = BigInt(match[1]!);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const minor = major * 100n + BigInt(fraction || "0");
  if (minor <= 0n)
    throw Object.assign(
      new Error("Compact Buzz bounty reward must be positive"),
      { code: "OEXL_BUZZ_TASK_INVALID" }
    );
  return minor.toString();
};

export const parseBuzzTaskMessage = (
  message: string,
  profile?: BuzzChannelTaskProfile,
  now: Date = new Date()
): BuzzTaskCommand => {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/bounty"))
    throw Object.assign(
      new Error("Buzz task message must begin with /bounty"),
      {
        code: "OEXL_BUZZ_TASK_INVALID"
      }
    );
  const body = trimmed.slice("/bounty".length).trim();
  if (!body)
    throw Object.assign(
      new Error("Buzz task message must include a reward and outcome"),
      { code: "OEXL_BUZZ_TASK_INVALID" }
    );
  if (!body.startsWith("{") && !body.startsWith("```")) {
    if (!profile)
      throw Object.assign(
        new Error(
          "This Buzz channel is not configured for compact bounty commands"
        ),
        { code: "OEXL_BUZZ_TASK_INVALID" }
      );
    const separator = body.search(/\s/);
    if (separator < 0)
      throw Object.assign(
        new Error("Compact Buzz bounty must include an outcome"),
        { code: "OEXL_BUZZ_TASK_INVALID" }
      );
    const reward = body.slice(0, separator);
    const outcome = body.slice(separator).trim();
    if (!outcome)
      throw Object.assign(
        new Error("Compact Buzz bounty must include an outcome"),
        { code: "OEXL_BUZZ_TASK_INVALID" }
      );
    return buzzTaskCommandSchema.parse({
      schemaVersion: "oexl.buzz-task.v1",
      repository: profile.repository,
      outcome,
      acceptanceCriteria: profile.acceptanceCriteria.map((criterion) =>
        criterion.replaceAll("{{outcome}}", outcome)
      ),
      reward: {
        amountMinor: compactRewardMinor(reward),
        currency: "USD"
      },
      allowedPaths: profile.allowedPaths,
      validation: profile.validation,
      permittedExecutionModes: profile.permittedExecutionModes,
      deadline: new Date(
        now.getTime() + profile.deadlineSeconds * 1_000
      ).toISOString()
    });
  }
  try {
    const unwrapped = body
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    return buzzTaskCommandSchema.parse(JSON.parse(unwrapped));
  } catch (cause) {
    throw Object.assign(new Error("Buzz task contract is invalid"), {
      code: "OEXL_BUZZ_TASK_INVALID",
      cause
    });
  }
};

export const buzzDecisionSchema = z.object({
  relayUrl: z
    .string()
    .url()
    .regex(/^(?:https?|wss?):\/\//),
  authorPubkey: buzzHexId,
  channelId: z.string().uuid(),
  eventId: buzzHexId,
  emoji: z.enum(["✅", "❌"])
});

export type BuzzDecision = z.infer<typeof buzzDecisionSchema>;

export const buzzPaymentRequestSchema = z.object({
  schemaVersion: z.literal("oexl.buzz-payment-request.v1"),
  settlementId: z.string().regex(/^xst_[A-Za-z0-9_]+$/),
  deliverableId: z.string().regex(/^dlv_[A-Za-z0-9_]+$/),
  invoice: z.string().trim().min(20).max(8_000),
  paymentHash: buzzHexId,
  amountMsats: z.string().regex(/^[1-9][0-9]*$/),
  pricingBasis: z.literal("explicit_msats"),
  expiresAt: z.string().datetime()
});
export type BuzzPaymentRequest = z.infer<typeof buzzPaymentRequestSchema>;

export const buzzPaymentDecisionSchema = z.object({
  relayUrl: z
    .string()
    .url()
    .regex(/^(?:https?|wss?):\/\//),
  authorPubkey: buzzHexId,
  channelId: z.string().uuid(),
  eventId: buzzHexId,
  settlementId: z.string().regex(/^xst_[A-Za-z0-9_]+$/),
  emoji: z.enum(["⚡", "❌"])
});
export type BuzzPaymentDecision = z.infer<typeof buzzPaymentDecisionSchema>;
