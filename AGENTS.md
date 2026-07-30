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
- The `decisions/` AsDecided corpus is the durable authority for this public
  extension repository. Material work must trace to an accepted artifact and a
  bounded live roadmap.
- The corpus targets RAC specification `0.1`. Treat `asdecided/spec` as the
  normative compatibility authority and `asdecided/core` as the reference
  implementation. Keep `.rac/config.yaml` and `.decided/config.yaml`
  byte-identical until those repositories converge on one configuration path.
- The public corpus must remain useful to contributors without copying or
  paraphrasing confidential platform strategy, controls, or implementation.
- Commit headers and pull-request titles use
  `<type>(<scope>): <lower-case imperative summary>`. Material commit bodies
  identify their AsDecided artifact and roadmap, and every commit carries the
  contributor's own DCO sign-off.

Work on a feature branch and open a pull request. Do not commit directly to
`main` after the repository bootstrap.
