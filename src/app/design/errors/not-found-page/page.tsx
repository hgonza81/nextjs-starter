import { notFound } from "next/navigation";

/** Fault fixture (PH-FR-23): a page that calls `notFound()` (expected 404, not an error). */
export default function NotFoundFixturePage(): never {
  notFound();
}
