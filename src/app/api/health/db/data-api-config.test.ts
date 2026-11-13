import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// FND-FR-08 / ADR 0003: the Supabase Data API (PostgREST) stays off, so every
// query goes through Drizzle and `withRls`. This file-level check does not
// need the stack; the HTTP check in tests/db/hardening-catalog.test.ts proves
// the running stack agrees.
const CONFIG_PATH = fileURLToPath(
  new URL("../../../../../supabase/config.toml", import.meta.url),
);

/** Returns the raw value of `key` inside `[section]`, ignoring comments. */
function readTomlValue(
  toml: string,
  section: string,
  key: string,
): string | undefined {
  let current = "";
  let found: string | undefined;
  for (const rawLine of toml.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const header = /^\[([^\]]+)\]\s*(#.*)?$/.exec(line);
    if (header) {
      current = header[1]!.trim();
      continue;
    }
    if (current !== section) continue;
    const pair = /^([A-Za-z0-9_.-]+)\s*=\s*([^#]*?)\s*(#.*)?$/.exec(line);
    if (pair && pair[1] === key) found = pair[2];
  }
  return found;
}

describe("supabase/config.toml Data API", () => {
  it("FND-FR-08: [api] has enabled = false", () => {
    const toml = readFileSync(CONFIG_PATH, "utf8");

    expect(readTomlValue(toml, "api", "enabled")).toBe("false");
  });

  describe("readTomlValue (self-check of the parser)", () => {
    it("FND-FR-08: ignores an enabled key that belongs to another section", () => {
      const toml = "[api]\nport = 1\n[auth]\nenabled = false\n";

      expect(readTomlValue(toml, "api", "enabled")).toBeUndefined();
    });

    it("FND-FR-08: ignores commented-out keys and reads past trailing comments", () => {
      const toml =
        "[api]\n# enabled = false\nenabled = true # on\n[db]\nenabled = false\n";

      expect(readTomlValue(toml, "api", "enabled")).toBe("true");
    });

    it("FND-FR-08: does not confuse [api] with a sub-table such as [api.tls]", () => {
      const toml = "[api.tls]\nenabled = false\n[api]\nenabled = true\n";

      expect(readTomlValue(toml, "api", "enabled")).toBe("true");
    });
  });
});
