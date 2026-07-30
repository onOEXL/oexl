# Buzz integration

`@oexl/buzz` provides a public compatibility layer between signed Buzz/Nostr
events and OEXL outcome contracts. It does not operate an exchange, select a
provider, settle a reward, or store participant credentials.

This is independently developed compatibility work for the open-source
[`block/buzz`](https://github.com/block/buzz) protocol surface. It is not an
official Block integration, partnership, or endorsement.

## Public contract

The package exports:

- schemas for structured and compact `/bounty` task messages;
- channel profiles that bind compact commands to an approved repository,
  commit, path scope, acceptance criteria, validation mode, and deadline;
- schemas for buyer acceptance and rejection reactions;
- signed lifecycle and deliverable publishers;
- NIP-98 request signing and verification helpers;
- a small relay client interface; and
- environment parsing for one compatibility binding.

## Example

```ts
import { buzzChannelTaskProfileSchema, parseBuzzTaskMessage } from "@oexl/buzz";

const profile = buzzChannelTaskProfileSchema.parse({
  channelId: "f9148f50-4537-47ec-b919-3eb73edb3d91",
  repository: {
    cloneUrl: "https://github.com/acme/widget",
    owner: "acme",
    repoId: "acme/widget",
    baseSha: "0123456789abcdef0123456789abcdef01234567"
  },
  allowedPaths: ["docs/**"],
  acceptanceCriteria: ["The patch satisfies: {{outcome}}"],
  validation: {
    method: "buyer_review",
    commands: []
  },
  permittedExecutionModes: ["human_supervised"],
  deadlineSeconds: 86_400
});

const task = parseBuzzTaskMessage(
  "/bounty $0.50 Add the release note",
  profile
);
```

The parser returns a bounded `oexl.buzz-task.v1` contract. A host remains
responsible for authenticating the author, checking invitation and repository
policy, reserving any reward, and deciding whether the task may enter an
exchange.

## Identity boundary

- Treat the relay event as untrusted until its signature and exact event ID are
  verified.
- Bind NIP-98 proofs to the exact HTTP method, URL, and body.
- Exchange a verified identity proof for a separate, scoped application token;
  do not reuse participant Nostr keys as service credentials.
- Keep participant and bot private keys local.
- Reject wrong-relay, wrong-channel, wrong-author, replayed, expired, or
  unsupported events before changing state.

## Lifecycle publication

`BuzzLifecyclePublisher` and `BuzzDeliverablePublisher` are host-injected
publishers. The host supplies the event context and decides when a lifecycle
transition is authoritative. The publisher formats and signs the corresponding
Buzz event; it does not make matching or settlement decisions.

Use concise lifecycle states such as:

```text
Task funded
Provider matched
Deliverable ready
Complete
Rejected
```

Only the exchange's authoritative acceptance transition should be described as
settled. A reaction or chat event alone is not payment evidence.

## Workflow examples

[`examples/buzz`](../examples/buzz) contains illustrative workflow definitions
for bounty intake, acceptance, and rejection. Inspect and adapt them before
installing them in a Buzz workspace. Workflow headers are visible to workspace
members and must not be treated as the identity trust boundary.

## Testing

Package tests use deterministic signed fixtures and require no live Buzz relay:

```bash
pnpm --filter @oexl/buzz test
```
