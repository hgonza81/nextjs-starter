/**
 * Public API of the database module (ADR 0001, ADR 0003). The raw client in
 * `client.ts` stays private: all queries go through `withRls`.
 */
export * from "./schema";
export {
  withAnonymousRls,
  withRls,
  type RlsTransaction,
  type VerifiedContext,
} from "./rls";
