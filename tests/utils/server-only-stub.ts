// Vitest replaces the `server-only` package with this empty module. The real
// package throws outside the Next.js server environment, which would make every
// server module untestable. The boundary itself is enforced by Next.js builds.
export {};
