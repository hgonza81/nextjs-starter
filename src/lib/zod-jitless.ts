import { z } from "zod";

/**
 * Turns off Zod's JIT compilation (PH-FR-15, ADR 0014).
 *
 * Zod probes `new Function("")` when the first schema is created in the
 * browser. The throw is swallowed, but under a CSP without `'unsafe-eval'`
 * Chromium still reports a violation. With `jitless` set, Zod skips the probe.
 *
 * Convention: every client file that builds Zod schemas imports this module
 * FIRST (side-effect import), before any import that creates a schema.
 */
z.config({ jitless: true });
