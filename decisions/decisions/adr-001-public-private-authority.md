---
schema_version: 1
id: ELAO-KYN9A1B2C3D5
type: decision
---

# ADR-001: Publish Extensions Without Publishing Exchange Authority

## Context

OEXL's hooks and integrations benefit from public review and contribution.
Its matching engine, control plane, settlement implementation, operational
controls, and private venue behaviour should not be public.

A public repository copied from the platform would retain private history and
create an unsafe dependency direction. A repository containing only prose
would not provide contributors with useful, executable contracts.

## Decision

Maintain two explicit repository authorities:

- `onOEXL/oexl` is the public, Apache-2.0 implementation authority for public
  contracts, hooks, integrations, examples, and deterministic compatibility
  tests.
- `onOEXL/platform` is the private implementation authority for matching,
  allocation, settlement, venue policy, control-plane behaviour, and
  operations.

The public repository uses a clean history and never imports private platform
code. The private platform may consume released public packages through their
published interfaces.

Public extensions can verify surface identity, ingest authorised commands,
publish lifecycle presentation, and transport signed envelopes. They cannot
match, allocate, accept, settle, mutate the ledger, deploy, merge, force-push,
or write directly to a default branch.

The public corpus records only decisions that contributors must be able to
review. Internal product strategy and implementation decisions remain in the
private corpus.

## Consequences

Positive consequences:

- Contributors can develop and validate extensions without private access.
- Package contracts and their rationale are reviewable in the same repository.
- Private exchange authority and Git history remain undisclosed.
- The dependency direction is explicit and mechanically testable.

Negative consequences:

- Some changes require coordinated pull requests across two repositories.
- Public artifacts must be written carefully enough to explain contracts
  without disclosing internal platform controls.
- Package releases need compatibility discipline.

## Status

Accepted

## Category

Architecture

## Alternatives Considered

### Keep the complete monorepo public

Rejected because it would publish the matching and control-plane implementation.

### Make every repository private

Rejected because hooks, integrations, and compatibility contracts benefit from
public inspection and contribution.

### Copy platform history and delete private paths

Rejected because deleted files remain recoverable from Git history.

## Applies To

- packages/buzz/
- packages/github/
- packages/nwc/
- examples/
- docs/public-private-boundary.md

## Related Requirements

- ELAO-KYN9A1B2C3D4

## Related Roadmaps

- ELAO-KYN9A1B2C3D6
