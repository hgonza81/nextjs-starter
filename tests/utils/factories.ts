import { newId, uniqueEmail, uniqueName } from "./ids";
import type { UserClaims } from "./roles";

/**
 * Factory STUBS (FND-FR-21). They only build unique in-memory values; nothing
 * is inserted, because `auth.users`, tenants and memberships do not exist until
 * epic 002, which replaces these with real factories (same names and shapes).
 */
export type TestUser = {
  id: string;
  email: string;
  /** Ready for `asUser(user.claims)`. */
  claims: UserClaims;
};

export function createTestUser(overrides: { email?: string } = {}): TestUser {
  const id = newId();
  const email = overrides.email ?? uniqueEmail();
  return { id, email, claims: { sub: id, email } };
}

export type TestTenant = { id: string; name: string };

export function createTenant(overrides: { name?: string } = {}): TestTenant {
  return { id: newId(), name: overrides.name ?? uniqueName("Company") };
}
