---
schema_version: 1
id: ELAO-KYN9A1B2C3D4
type: requirement
---

# Govern OEXL's Public Extension Surface

## Problem

OEXL needs a useful open-source surface that contributors can inspect, extend,
and depend on without exposing or coupling to the private exchange platform.
The public/private split must remain reviewable as the interfaces evolve.

## Requirements

- [REQ-001] This repository MUST contain only public contracts, SDKs, hooks, integrations, examples, documentation, and deterministic compatibility tests.
- [REQ-002] Public packages MUST NOT import, embed, reconstruct, or otherwise depend on private platform code or Git history.
- [REQ-003] Matching, allocation, ranking, reputation, settlement, payments, tenant administration, operator tooling, infrastructure, and production security controls MUST remain outside this repository.
- [REQ-004] Hooks MUST use signed inputs, idempotent effects, replay-aware processing, bounded payloads, and explicit failure behaviour.
- [REQ-005] Extensions MUST NOT become the authority for matching, acceptance, ledger state, settlement, deployment, or default-branch mutation.
- [REQ-006] Material public-interface changes MUST trace to an accepted AsDecided artifact and a bounded live roadmap before implementation.
- [REQ-007] Pull requests MUST pass the pinned AsDecided v0.24.1 corpus gate, deterministic repository checks, and the Developer Certificate of Origin check.
- [REQ-008] Public contributions MUST remain Apache-2.0 licensed.
- [REQ-009] Public contributions MUST NOT contain credentials, private data, or proprietary third-party material.
- [REQ-010] The corpus MUST keep `.rac/config.yaml` and `.decided/config.yaml` byte-identical while both paths are required for specification and reference-implementation compatibility.

## Success Metrics

- `decided gate decisions/` exits `0` locally and in pull-request CI.
- A clean checkout passes `pnpm check` without access to the private platform,
  a provider account, payment credentials, or the internet.
- Every material implementation pull request names its accepted artifact and
  live roadmap.
- The public-boundary check rejects private platform concepts and dependencies.
- A contributor can determine supported scope, excluded scope, compatibility
  effects, and verification evidence from public repository material alone.

## Risks

- Public interfaces could accidentally reveal private implementation details.
  Mitigation: keep the corpus public-safe, require code-owner review, and run
  the deterministic boundary check.
- The public and private repositories could become mutually dependent.
  Mitigation: permit the private platform to consume versioned public packages,
  but prohibit imports or history copied in the opposite direction.
- Decision records could be written after implementation. Mitigation: require a
  live roadmap reference before material work begins.

## Assumptions

- OEXL is the canonical product name and `ELAO` is the durable corpus identity.
- The private platform repository retains the complete internal product corpus.
- Public interfaces can be useful and independently testable without disclosing
  matching or control-plane implementation.

## Status

Accepted

## Related Decisions

- ELAO-KYN9A1B2C3D5

## Related Roadmaps

- ELAO-KYN9A1B2C3D6
