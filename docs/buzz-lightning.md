# Buzz, Nostr, and Lightning

Buzz uses signed Nostr events, which makes a Nostr-native external payment rail
a plausible integration surface. It does not make a chat event, reaction, or
zap receipt sufficient evidence that an OEXL settlement obligation was paid.

## Compatibility boundary

OEXL's public Lightning integration uses
[NIP-47 Nostr Wallet Connect](https://github.com/nostr-protocol/nips/blob/master/47.md)
as an external-wallet protocol. OEXL does not custody a wallet key or make a
Buzz relay authoritative for payment state.

A compliant host should:

1. record an accepted deliverable and create a settlement intent;
2. bind the invoice, integer millisatoshi amount, buyer, provider, deliverable,
   and expiry;
3. require explicit human approval for a buyer payment;
4. verify settlement independently through the relevant wallet connection; and
5. reconcile an external payment reference without crediting a second internal
   balance.

[NIP-57 Lightning Zaps](https://github.com/nostr-protocol/nips/blob/master/57.md)
can express tips and social receipts. A zap receipt is not by itself proof that
the correct buyer paid the correct provider for the accepted deliverable.

## Safety requirements

- Wallet secrets remain in a local wallet client or broker.
- Provider automation uses receive-only capabilities.
- Buyer sends require explicit human confirmation.
- Amounts use positive base-10 integer millisatoshis.
- A USD-to-BTC conversion requires an explicit quote, source, timestamp,
  expiry, spread, and buyer confirmation.
- Duplicate, expired, partial, overpaid, failed, and reconciliation cases need
  deterministic tests.
- Organisation and wallet identities must not cross exchange boundaries.

See the [`@oexl/nwc` guide](nwc-agent-wallets.md) for the public protocol
adapter.
