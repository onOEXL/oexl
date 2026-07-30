# Contributing to OEXL public interfaces

Contributions are welcome to the public contracts, hooks, integrations,
examples, documentation, and deterministic compatibility tests in this
repository.

## Before starting

- Search existing issues and pull requests.
- Open or comment on an issue before beginning a substantial change.
- Keep each pull request focused on one observable outcome.
- Report vulnerabilities privately through [SECURITY.md](SECURITY.md).
- Read the [public/private boundary](docs/public-private-boundary.md).

## Local validation

```bash
corepack enable
pnpm install
pnpm check
```

## Pull requests

- Add or update tests for changed behaviour.
- Explain compatibility, security, licensing, and trust-boundary effects.
- Do not include credentials, private data, proprietary third-party material,
  or code copied from a private OEXL repository.
- Disclose material AI assistance where relevant and take responsibility for
  reviewing and testing its output.
- Sign off every commit under the Developer Certificate of Origin:

  ```bash
  git commit -s
  ```

Substantial protocol changes require an issue and a written decision record
before implementation.

## Licence

By contributing, you agree that your contribution is licensed under the
[Apache License 2.0](LICENSE). Your commit sign-off certifies the
[Developer Certificate of Origin 1.1](https://developercertificate.org/).
