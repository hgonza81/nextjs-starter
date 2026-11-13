import {
  oversizedBodyAction,
  redirectAction,
  throwingAction,
} from "@/app/design/errors/actions";

/**
 * Fault fixture (PH-FR-23): one real page that posts to real Server Actions, so
 * the action ids are genuine (PH-AC-30 and 67 drive posts through these forms).
 * Plain forms, no client JS needed.
 */
export default function FaultFormPage() {
  return (
    <main>
      <h1>Fault fixtures: actions</h1>

      <form action={throwingAction}>
        <input type="hidden" name="token" value="form" />
        <button type="submit">Throwing action</button>
      </form>

      <form action={oversizedBodyAction}>
        <label htmlFor="payload">Payload</label>
        <textarea id="payload" name="payload" />
        <button type="submit">Send payload</button>
      </form>

      <form action={redirectAction}>
        <button type="submit">Redirecting action</button>
      </form>
    </main>
  );
}
