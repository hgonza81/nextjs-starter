# tests/utils

Shared test helpers; usage is documented in [`../README.md`](../README.md).
`server-only-stub.ts` is the empty module that Vitest aliases `server-only` to
(see `vitest.config.mts`). `local-env.mts` is `.mts` because the Vitest config
imports it.
