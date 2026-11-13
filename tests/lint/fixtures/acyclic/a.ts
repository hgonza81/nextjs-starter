// Lint fixture for rule (e): a legal one-way import.
import { b } from "./b";

export const a = (): string => b();
