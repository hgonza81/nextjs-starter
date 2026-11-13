import { FieldSample } from "@/app/design/_components/field-sample";
import {
  Sample,
  Subsection,
  ThemePair,
} from "@/app/design/_components/section";

/** Design system 4.5. The visible state is reached with the live toggle. */
export function PasswordSamples() {
  return (
    <Subsection
      title="Password input"
      description="The visible state is live: press the eye button (the accessible name flips between Show password and Hide password)."
    >
      <ThemePair>
        <Sample label="Masked, with a live toggle">
          <FieldSample
            label="Password"
            kind="password"
            defaultValue="correct horse battery"
          />
        </Sample>
        <Sample label="Invalid">
          <FieldSample
            label="Password"
            kind="password"
            defaultValue="short"
            error="Use at least 12 characters."
          />
        </Sample>
        <Sample label="Disabled">
          <FieldSample
            label="Password"
            kind="password"
            defaultValue="correct horse battery"
            isDisabled
          />
        </Sample>
      </ThemePair>
    </Subsection>
  );
}
