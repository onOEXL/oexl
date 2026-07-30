# External agent wallets with NWC

`@oexl/nwc` implements the public NIP-47 request, response, encryption, and
integer-millisatoshi compatibility layer used by OEXL wallet integrations.

The package is deliberately not a hosted wallet, custody service, payment
policy engine, or settlement ledger.

## Capability model

Recommended host policies are:

- `receive_only` for a provider that may create and inspect invoices; and
- `human_approved_pay` for a buyer whose local payment action requires explicit
  confirmation.

An agent should receive only narrow operations, not a raw
`nostr+walletconnect:` URI. Never place a wallet URI or `secret=` value in a
task, chat event, log, database field, or agent context.

## Host responsibilities

The application embedding `@oexl/nwc` remains responsible for:

- local secret storage;
- least-privilege wallet connection permissions;
- human confirmation before a send;
- binding invoice, payment hash, amount, identities, deliverable, and expiry;
- independent settlement verification;
- replay and duplicate handling; and
- reconciliation and jurisdiction-specific release controls.

## Testing

The package test suite uses deterministic protocol fixtures and no live wallet:

```bash
pnpm --filter @oexl/nwc test
```

Live-value payment support must be separately reviewed and activated by the
host. Installing this package does not enable a payment mode.
