# 0010. Toolchain pinning and dependency supply chain

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
A starter that others clone must install the same tree every time, and a large app multiplies the exposure to compromised or broken releases. The PO accepted pnpm, current stable Next.js, active-LTS Node, all pinned (questions.md Q6 accepted part, spec D8, FND-FR-02, FND-NFR-06) and ESLint + Prettier (Q7, D9). The package manager and the pin policy are hard to change once a lockfile and CI exist.

## Options considered
1. **pnpm, exact versions, committed lockfile, `engineStrict`, Node floor pinned.** Pros: reproducible, strict dependency resolution, fast CI cache. Cons: Node 26 ships without corepack, so pnpm is installed separately.
2. **npm (+ same workflow).** Pros: no extra install. Cons: not what the PO chose (Q6 offered it as alternative B; pnpm accepted).
3. **Biome instead of ESLint + Prettier.** Pros: one fast tool. Cons: weaker boundary-rule options (ADR 0001 amendment). Rejected (Q7 A).

## Decision
Option 1:
- **pnpm 12.18.0** via `packageManager`; `saveExact: true` and `engineStrict: true` in `pnpm-workspace.yaml` (pnpm 12 ignores `.npmrc` for these). Lockfile committed; CI uses `--frozen-lockfile`.
- **Node:** `engines.node` is `>=26.13.1 <27` (any 26.x patch at or above the floor, FND-T-49), `.nvmrc` is `26`. Under another Node, `pnpm install --force` rejects; a plain `pnpm install` on an installed tree skips the check, so the README says to check `node -v`.
- **Held back by peer ceilings:** TypeScript 6.0.3 and ESLint 9.39.5 (typescript-eslint and Next's ESLint config). `lint` is `eslint .` (no `next lint` in Next 16).
- **Supply-chain controls:** pnpm's `minimumReleaseAge` (24 hours, the default in use; `pnpm-workspace.yaml` does not set it) delays brand-new releases; `minimumReleaseAgeExclude` holds exact-version exceptions only (three entries today), removed once the version is a day old. `postinstall` scripts are not run for `esbuild` (`allowBuilds: esbuild: false`). New dependencies need a requirement; package provenance is checked for unfamiliar names (the `cn` package, architecture.md Dependency notes). Gitleaks and `pnpm audit` run in CI (ADR 0009).
- **Dependency updates are manual.** Dependabot's npm updater runs Node 24 and fails `engineStrict` (run 43336683433, FND-T-55), so only `github-actions` is automated; `pnpm audit` stays informational.

## Consequences
- Positive: identical installs locally and in CI, upgrades are explicit, little room for a surprise release.
- Negative: manual npm updates; exclusions need housekeeping; the Node floor makes Dependabot npm unusable until its updater supports Node 26.
- Revisit when Dependabot's updater supports Node 26 (re-add the npm ecosystem, comment in `.github/dependabot.yml`), or when TypeScript 7 / ESLint 10 are supported by the lint stack.

## Question for the Product Owner (not blocking)
Should `minimumReleaseAge` be set explicitly in `pnpm-workspace.yaml` (so the policy does not depend on the pnpm default)? Source: acceptance/step-5-6.md suggestion 4. Recommended: yes, one line with a comment, in a later housekeeping change.

## References
- `specs/001-foundations/questions.md` (Q6, Q7), `spec.md` (D8, D9, FND-FR-02, FND-NFR-06), `acceptance/step-1.md`, `acceptance/step-5-6.md`.
- `docs/architecture.md` (Dependency notes, CI/CD), ADR 0001 amendment (lint tooling), `pnpm-workspace.yaml`, `.github/dependabot.yml`.
- The default value of `minimumReleaseAge` is stated in `docs/architecture.md` (1440 minutes); the pnpm settings page was not conclusive when this ADR was written, confirm against the pnpm 12 docs when setting it explicitly.
