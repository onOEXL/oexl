---
schema_version: 1
id: ELAO-KYN9A1B2C3D6
type: roadmap
---

# Public Boundary Foundation

## Status

Achieved

## Horizon

now

## Outcomes

- Establish a useful public OEXL extension repository with no private platform
  code or history.
- Make the repository boundary, licensing, contribution route, and extension
  authority explicit.
- Enforce the public corpus, compatibility checks, tests, and DCO on pull
  requests.

## Initiatives

- Publish the Buzz, GitHub, and NWC extension packages with focused examples.
- Record the public extension requirement and public/private authority
  decision as accepted artifacts.
- Add mirrored specification and native AsDecided configuration.
- Add a pull-request corpus gate pinned to AsDecided v0.24.1.
- Require public-boundary, formatting, lint, type, test, and DCO checks.
- Protect `main` after the bootstrap pull request is merged.

## Success Measures

- `decided gate decisions/` passes locally and in GitHub Actions.
- `pnpm check` passes from a clean checkout.
- The public repository contains no matching, allocation, settlement,
  control-plane, operational, or secret material.
- The packages build without emitting test files into publishable output.
- Future material pull requests identify an accepted artifact and bounded live
  roadmap.

## Assumptions

- The private platform remains the complete internal product authority.
- The initial extracted packages are independently useful and testable.
- Changes spanning the boundary will be reviewed in separate, linked pull
  requests.

## Risks

- A boundary check based only on names may miss conceptual leakage. Mitigation:
  retain code-owner review and require explicit trust-boundary analysis.
- The first public package contracts may evolve. Mitigation: document
  compatibility effects and prefer additive versioned changes.
- Bootstrap checks cannot be required until their workflows exist on the
  default branch. Mitigation: merge only after all introduced checks pass, then
  configure branch protection.

## Related Requirements

- ELAO-KYN9A1B2C3D4

## Related Decisions

- ELAO-KYN9A1B2C3D5
