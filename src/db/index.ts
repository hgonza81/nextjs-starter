/**
 * Public API of the database module (ADR 0001, ADR 0003). The raw client in
 * `client.ts` stays private; `withRls` is added by FND-T-12.
 */
export * from "./schema";
