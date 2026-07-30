# Contributing to OEXL public interfaces

Contributions are welcome to the public contracts, hooks, integrations,
examples, documentation, and deterministic compatibility tests in this
repository.

## Before starting

- Search existing issues and pull requests.
- Open or comment on an issue before beginning a substantial change.
- Keep each pull request focused on one observable outcome.
- For a material interface or product change, identify an accepted artifact
  under `decisions/` and a bounded live roadmap before implementation.
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
- Name the accepted AsDecided artifact and live roadmap governing material
  changes. Use `Not applicable` only for bounded maintenance work.
- Explain compatibility, security, licensing, and trust-boundary effects.
- Do not include credentials, private data, proprietary third-party material,
  or code copied from a private OEXL repository.
- Disclose material AI assistance where relevant and take responsibility for
  reviewing and testing its output.
- Sign off every commit under the Developer Certificate of Origin:

  ```bash
  git commit -s
  ```

## Commit and pull-request titles

Every commit header and pull-request title uses:

```text
<type>(<scope>): <lower-case imperative summary>
```

Allowed types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
`refactor`, `revert`, `style`, and `test`. A scope is required, must be
lower-case kebab-case, and should name the smallest stable subsystem affected.
Common public scopes include `buzz`, `github`, `nwc`, `protocol`, `examples`,
`docs`, `security`, `deps`, `release`, `ci`, and `repo`.

Use the type to describe the effect:

```text
feat(buzz): verify signed acceptance receipts
fix(github): reject stale publication commands
docs(protocol): define replay-safe webhook cursors
chore(deps): update the pnpm lockfile
ci(repo): enforce the AsDecided corpus gate
```

`chore(engine)` is appropriate for engine maintenance; a behavioural engine
change would use `feat(engine)`, `fix(engine)`, `perf(engine)`, or
`refactor(engine)`.

Keep the complete header to 72 characters, start the summary in lower case, and
do not end it with a full stop. Use `!` before the colon for an intentional
breaking change.

For material work, add the governing authority to the commit body:

```text
AsDecided-Artifact: ELAO-…
AsDecided-Roadmap: <codename> (ELAO-…)
```

Substantial protocol changes require an issue and a written decision record
before implementation.

## Licence

By contributing, you agree that your contribution is licensed under the
[Apache License 2.0](LICENSE). Your commit sign-off certifies the
[Developer Certificate of Origin 1.1](https://developercertificate.org/).
