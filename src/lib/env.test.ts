import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Both env modules validate at import time, so each case stubs the variables
// and imports a fresh copy of the module.
const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-tests",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};
const validServer = {
  DATABASE_URL:
    "postgresql://app_backend:pw-for-tests@127.0.0.1:54322/postgres",
  DATABASE_MIGRATION_URL:
    "postgresql://postgres:pw-for-tests@127.0.0.1:54322/postgres",
};

function stubAll(
  overrides: Record<string, string | undefined> = {},
  nodeEnv = "test",
) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  for (const [name, value] of Object.entries({
    ...validPublic,
    ...validServer,
    ...overrides,
  })) {
    vi.stubEnv(name, value);
  }
}

const loadPublic = () => import("@/lib/env");
const loadServer = () => import("@/lib/env.server");

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public env (src/lib/env.ts)", () => {
  it("FND-FR-03: exposes the validated public variables", async () => {
    stubAll();

    const { publicEnv } = await loadPublic();

    expect(publicEnv).toEqual(validPublic);
  });

  it.each(Object.keys(validPublic))(
    "FND-FR-03: fails naming %s when it is missing",
    async (name) => {
      stubAll({ [name]: undefined });

      await expect(loadPublic()).rejects.toThrow(
        new RegExp(`Invalid environment variables[\\s\\S]*${name}`),
      );
    },
  );

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_APP_URL"])(
    "FND-FR-03: rejects a malformed URL in %s",
    async (name) => {
      stubAll({ [name]: "not a url" });

      await expect(loadPublic()).rejects.toThrow(name);
    },
  );

  it("FND-FR-03: rejects an empty anon key", async () => {
    stubAll({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "" });

    await expect(loadPublic()).rejects.toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("FND-FR-03: error message never contains the offending value", async () => {
    stubAll({ NEXT_PUBLIC_APP_URL: "super-secret-bad-value" });

    await expect(loadPublic()).rejects.not.toThrow(/super-secret-bad-value/);
  });

  it("FND-NFR-05 / ADR 0004: no public variable name matches SERVICE|SECRET|PASSWORD|DATABASE", async () => {
    stubAll();

    const { publicEnv } = await loadPublic();

    for (const name of Object.keys(publicEnv)) {
      expect(name).toMatch(/^NEXT_PUBLIC_/);
      expect(name).not.toMatch(/SERVICE|SECRET|PASSWORD|DATABASE/);
    }
  });

  it("FND-NFR-05: server-only values are absent from the public object", async () => {
    stubAll();

    const { publicEnv } = await loadPublic();
    const serialized = JSON.stringify(publicEnv);

    expect(serialized).not.toContain(validServer.DATABASE_URL);
    expect(serialized).not.toContain(validServer.DATABASE_MIGRATION_URL);
    expect(serialized).not.toContain("pw-for-tests");
  });
});

describe("server env (src/lib/env.server.ts)", () => {
  it("FND-FR-03: exposes the validated server variables", async () => {
    stubAll();

    const { serverEnv } = await loadServer();

    expect(serverEnv).toEqual({ NODE_ENV: "test", ...validServer });
  });

  it.each(["development", "test"])(
    "FND-FR-03: in %s, a missing DATABASE_URL fails naming it",
    async (nodeEnv) => {
      stubAll({ DATABASE_URL: undefined }, nodeEnv);

      await expect(loadServer()).rejects.toThrow(/DATABASE_URL: Required/);
    },
  );

  it("FND-FR-03: in development, a missing DATABASE_MIGRATION_URL fails naming it", async () => {
    stubAll({ DATABASE_MIGRATION_URL: undefined }, "development");

    await expect(loadServer()).rejects.toThrow(/DATABASE_MIGRATION_URL/);
  });

  it("FND-FR-03: a blank DATABASE_URL counts as not set", async () => {
    stubAll({ DATABASE_URL: "" }, "test");

    await expect(loadServer()).rejects.toThrow(/DATABASE_URL: Required/);
  });

  it("FND-FR-03: in production the database variables are optional", async () => {
    stubAll(
      { DATABASE_URL: undefined, DATABASE_MIGRATION_URL: undefined },
      "production",
    );

    const { serverEnv } = await loadServer();

    expect(serverEnv.NODE_ENV).toBe("production");
    expect(serverEnv.DATABASE_URL).toBeUndefined();
  });

  it("FND-FR-03: in production, a malformed DATABASE_URL is still rejected", async () => {
    stubAll({ DATABASE_URL: "nope" }, "production");

    await expect(loadServer()).rejects.toThrow(/DATABASE_URL/);
  });

  it("FND-FR-03: rejects an unknown NODE_ENV", async () => {
    stubAll({}, "staging");

    await expect(loadServer()).rejects.toThrow(/NODE_ENV/);
  });

  it("FND-FR-03: requireDatabaseUrl returns the configured URL", async () => {
    stubAll();

    const { requireDatabaseUrl } = await loadServer();

    expect(requireDatabaseUrl()).toBe(validServer.DATABASE_URL);
  });

  it("FND-FR-03: in production, requireDatabaseUrl throws naming DATABASE_URL when unset", async () => {
    stubAll({ DATABASE_URL: undefined }, "production");

    const { requireDatabaseUrl } = await loadServer();

    expect(() => requireDatabaseUrl()).toThrow(/DATABASE_URL is required/);
  });
});
