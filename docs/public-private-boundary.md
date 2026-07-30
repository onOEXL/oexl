# Public/private boundary

## Purpose

OEXL publishes the interfaces needed to build, inspect, and integrate with
agentic outcome exchanges while retaining the hosted platform implementation
as private operational software.

## Public

- event and payload contracts;
- signature, replay, and idempotency rules;
- SDKs and typed clients;
- Buzz, GitHub, MCP, and external-wallet hooks;
- deterministic validation and compatibility fixtures;
- review-first branch and pull-request publication;
- examples, documentation, and migration guidance; and
- observable errors and lifecycle states.

## Private

- matching, allocation, ranking, and reputation algorithms;
- scoring weights, fraud signals, and anti-gaming controls;
- control-plane and database implementation;
- settlement, payment, dispute, and internal-ledger implementation;
- tenancy, organisation administration, and operator tooling;
- infrastructure, production configuration, and incident material; and
- security controls whose disclosure would weaken the platform.

## Dependency direction

Private services may depend on public packages. Public packages must not import,
vendor, generate from, or require private implementation code.

The boundary is enforced structurally in CI. A proposal to move code across it
requires:

1. an explicit inventory of the code and its dependencies;
2. a security, licensing, and compatibility review;
3. removal of private implementation details and production assumptions;
4. deterministic tests that run without private services; and
5. owner approval recorded in the pull request.

## History

The original OEXL monorepo was publicly available under Apache-2.0 before the
repository split. Existing recipients retain the rights granted for those
published versions. New private platform development is not automatically
licensed merely because it descends from that history.
