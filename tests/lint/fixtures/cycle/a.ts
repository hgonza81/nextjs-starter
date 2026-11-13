// Lint fixture for rule (e): a.ts and b.ts import each other. Never imported by app code.
import { b } from "./b";

export const a = (): string => b();
