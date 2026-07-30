import { describe, expect, it } from "vitest";
import { readBuzzExchangeEnvironment } from "./config.js";

const webhookSecret = "w".repeat(32);

describe("Buzz organisation exchange environment", () => {
  it("loads one independently authenticated relay binding per exchange", () => {
    const bindings = readBuzzExchangeEnvironment(
      {
        OEXL_BUZZ_BINDINGS_JSON: JSON.stringify([
          {
            exchangeId: "exc_alpha",
            relayUrl: "https://buzz-alpha.example",
            webhookSecret,
            privateKey: "1".repeat(64),
            channels: [
              {
                channelId: "4cf8754b-3971-4c51-846c-2454e0aa9e22",
                repository: {
                  cloneUrl: "https://github.com/acme/widget",
                  owner: "acme",
                  repoId: "acme/widget",
                  baseSha: "a".repeat(40)
                },
                allowedPaths: ["docs/**"],
                acceptanceCriteria: ["{{outcome}}"],
                validation: { method: "buyer_review", commands: [] },
                permittedExecutionModes: ["autonomous"],
                deadlineSeconds: 86_400
              }
            ]
          },
          {
            exchangeId: "exc_beta",
            relayUrl: "https://buzz-beta.example",
            webhookSecret: "x".repeat(32),
            privateKey: "2".repeat(64)
          }
        ])
      },
      { defaultExchangeId: "exc_local", requireWebhookSecret: true }
    );

    expect(bindings.map((binding) => binding.exchangeId)).toEqual([
      "exc_alpha",
      "exc_beta"
    ]);
    expect(bindings[0]?.channels[0]?.repository.repoId).toBe("acme/widget");
  });

  it("keeps the legacy single-exchange control-worker configuration", () => {
    expect(
      readBuzzExchangeEnvironment(
        {
          OEXL_BUZZ_OEXL_URL: "https://buzz.example",
          OEXL_BUZZ_PRIVATE_KEY: "3".repeat(64)
        },
        { defaultExchangeId: "exc_local", requireWebhookSecret: false }
      )
    ).toEqual([
      {
        exchangeId: "exc_local",
        relayUrl: "https://buzz.example",
        privateKey: "3".repeat(64),
        channels: []
      }
    ]);
  });

  it("requires every API binding to have its own webhook secret", () => {
    expect(() =>
      readBuzzExchangeEnvironment(
        {
          OEXL_BUZZ_OEXL_URL: "https://buzz.example",
          OEXL_BUZZ_PRIVATE_KEY: "4".repeat(64)
        },
        { defaultExchangeId: "exc_local", requireWebhookSecret: true }
      )
    ).toThrow(/must be configured together/);
  });

  it("rejects duplicate exchanges and relay URLs", () => {
    expect(() =>
      readBuzzExchangeEnvironment(
        {
          OEXL_BUZZ_BINDINGS_JSON: JSON.stringify([
            {
              exchangeId: "exc_alpha",
              relayUrl: "https://buzz.example",
              webhookSecret,
              privateKey: "5".repeat(64)
            },
            {
              exchangeId: "exc_beta",
              relayUrl: "https://buzz.example/",
              webhookSecret: "y".repeat(32),
              privateKey: "6".repeat(64)
            }
          ])
        },
        { defaultExchangeId: "exc_local", requireWebhookSecret: true }
      )
    ).toThrow(/must be unique/);
  });

  it("does not silently mix JSON bindings with a legacy exchange selector", () => {
    expect(() =>
      readBuzzExchangeEnvironment(
        {
          OEXL_BUZZ_BINDINGS_JSON: JSON.stringify([
            {
              exchangeId: "exc_alpha",
              relayUrl: "https://buzz.example",
              webhookSecret,
              privateKey: "7".repeat(64)
            }
          ]),
          OEXL_BUZZ_EXCHANGE_ID: "exc_ignored"
        },
        { defaultExchangeId: "exc_local", requireWebhookSecret: true }
      )
    ).toThrow(/cannot be combined/);
  });

  it("rejects a channel profile reused across exchange bindings", () => {
    const channel = {
      channelId: "4cf8754b-3971-4c51-846c-2454e0aa9e22",
      repository: {
        cloneUrl: "https://github.com/acme/widget",
        owner: "acme",
        repoId: "acme/widget",
        baseSha: "a".repeat(40)
      },
      allowedPaths: ["docs/**"],
      acceptanceCriteria: ["{{outcome}}"],
      validation: { method: "buyer_review", commands: [] },
      permittedExecutionModes: ["autonomous"],
      deadlineSeconds: 86_400
    };
    expect(() =>
      readBuzzExchangeEnvironment(
        {
          OEXL_BUZZ_BINDINGS_JSON: JSON.stringify([
            {
              exchangeId: "exc_alpha",
              relayUrl: "https://buzz-alpha.example",
              webhookSecret,
              privateKey: "8".repeat(64),
              channels: [channel]
            },
            {
              exchangeId: "exc_beta",
              relayUrl: "https://buzz-beta.example",
              webhookSecret: "z".repeat(32),
              privateKey: "9".repeat(64),
              channels: [channel]
            }
          ])
        },
        { defaultExchangeId: "exc_local", requireWebhookSecret: true }
      )
    ).toThrow(/task profiles must be unique/);
  });
});
