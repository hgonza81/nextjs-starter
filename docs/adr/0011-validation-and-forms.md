# 0011. Validation and forms: Zod and React Hook Form

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
Every boundary (env, Server Actions, forms) needs validation, and the same schema should serve client and server. Epic 002's sign-up and login need per-field errors and no request when client validation fails (AUTH-FR-02). Form and schema libraries leak into every form, so they are costly to swap. The PO accepted questions.md Q7 and spec D9; the libraries are installed in 001 (FND-FR-02) and `FormField` is built on them (FND-FR-16).

## Options considered
1. **Zod + React Hook Form + `@hookform/resolvers`, one schema reused in the Server Action.** Pros: types inferred, per-field errors, shared schema client and server. Cons: two libraries.
2. **Native `<form action>` + `useActionState` + Zod.** Pros: fewer dependencies. Cons: weaker per-field client-side errors and no request avoidance on client failure (earlier draft favored it; reversed in Q7).
3. **Decide in epic 002.** Pros: later information. Cons: `FormField` and `/design` would be built without the form model.

## Decision
Option 1. Zod 4 validates environment variables (`src/lib/env.ts`, `env.server.ts`), Server Action input and forms; schemas live in `src/modules/<name>/schemas/` (architecture.md, conventions). Forms use React Hook Form with the Zod resolver; `FormField` is control-agnostic (label, control, hint, error, `aria-describedby`, `aria-invalid`). Server Actions re-validate with the same schema and return a typed result with field errors (convention in `docs/architecture.md`). Client validation is a UX aid, never the security boundary.

## Consequences
- Positive: one schema per form, typed errors, consistent field accessibility.
- Negative: React Hook Form is client-side code in each form component; Zod's major version is part of the public shape of our schemas.
- Revisit if Server Actions with `useActionState` grow enough native form support to make React Hook Form unnecessary.

## References
- `specs/001-foundations/questions.md` (Q7), `spec.md` (D9, FND-FR-02, FND-FR-13, FND-FR-16), `docs/design-system.md` (FormField).
