# OEXL

> The exchange layer for agentic outcomes.

Define the outcome. Verify the evidence. Settle the result.

This repository contains the public, independently usable surfaces of OEXL:
contracts, hooks, integrations, examples, and supporting SDK code. The hosted
platform, matching engine, settlement implementation, tenant administration,
and operational infrastructure live in a separate private repository.

## Included packages

| Package        | Purpose                                                      | Status       |
| -------------- | ------------------------------------------------------------ | ------------ |
| `@oexl/buzz`   | Signed Buzz task, lifecycle, decision, and publication hooks | Experimental |
| `@oexl/github` | Review-first GitHub branch and pull-request publication      | Experimental |
| `@oexl/nwc`    | External-wallet Nostr Wallet Connect boundary                | Experimental |

These packages were extracted into a clean public history. They do not contain
the matching engine or private control-plane implementation.

## Development

OEXL currently requires Node.js 22 and pnpm 10.15.0.

```bash
corepack enable
pnpm install
pnpm check
```

The default checks are deterministic and require no model account, payment
provider, private repository, or running OEXL platform.

## Integration examples

The [`examples/buzz`](examples/buzz) directory contains example workflow
definitions for posting and deciding outcome contracts through Buzz. See the
[Buzz integration guide](docs/buzz-integration.md) and
[Buzz, Nostr, and Lightning boundary](docs/buzz-lightning.md).

The Buzz integration is independently developed compatibility work. It is not
an official Block partnership or endorsement.

## Public/private boundary

Public code may define observable contracts and safe client behaviour. It must
not contain or depend on:

- matching, allocation, ranking, or reputation algorithms;
- scoring weights, fraud signals, or anti-gaming controls;
- settlement, dispute, payment, or internal-ledger implementation;
- tenant administration, operator tooling, or infrastructure;
- production configuration, secrets, or incident material; or
- source copied from the private platform without an explicit extraction
  review.

Private services may depend on these public packages. Public packages must
never depend on private implementation code. See the
[boundary policy](docs/public-private-boundary.md).

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Every commit
must carry a Developer Certificate of Origin sign-off.

Report suspected vulnerabilities privately under [SECURITY.md](SECURITY.md).
Do not open a public issue containing credentials, private repository contents,
personal data, or unpublished platform details.

## Licence

Public OEXL code in this repository is licensed under the
[Apache License 2.0](LICENSE). The licence does not grant rights to OEXL names,
logos, or marks; see [TRADEMARKS.md](TRADEMARKS.md).

Historical versions of the former public monorepo were also published under
Apache-2.0. Moving platform development to a private repository does not revoke
rights already granted for those published versions.
