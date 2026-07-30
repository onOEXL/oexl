# OEXL public repository guide

## Commands

- Install: `pnpm install`
- Full check: `pnpm check`
- Tests: `pnpm test`
- Build: `pnpm build`

## Invariants

- This repository contains public contracts, SDKs, hooks, integrations,
  examples, documentation, and deterministic compatibility tests.
- Do not add matching, allocation, ranking, reputation, settlement, payment,
  tenant-administration, operator, infrastructure, or production-secret code.
- Public packages must not import or otherwise depend on private platform code.
- Hooks must be safe by construction: signed inputs, idempotent effects,
  replay-aware processing, bounded payloads, and explicit failure behaviour.
- GitHub publication may create a review branch and pull request. It must never
  merge, deploy, force-push, or write directly to a default branch.
- External-wallet integrations must not make OEXL a custodian or transmit
  wallet credentials to the hosted platform.
- The traded primitive is an accepted outcome or deliverable, not model tokens,
  subscription allowance, credentials, prompts, runs, or compute.
- Tests must not require a model, provider account, private repository, payment
  provider, or internet access.
- Use OEXL for the product and `oexl` for protocol and package identifiers.
- Do not imply an official partnership or endorsement by an integration target.

Work on a feature branch and open a pull request. Do not commit directly to
`main` after the repository bootstrap.
