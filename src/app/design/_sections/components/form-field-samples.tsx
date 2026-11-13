import { FieldSample } from "@/app/design/_components/field-sample";
import { LiveForm } from "@/app/design/_components/live-form";
import {
  Sample,
  Subsection,
  ThemePair,
} from "@/app/design/_components/section";

const LONG_ERROR =
  "This value is not valid because it contains characters that are not allowed here, so remove them and try again with letters and numbers only.";

/** Design system 4.4. */
export function FormFieldSamples() {
  return (
    <Subsection
      title="FormField"
      description="Each sample wires its control with aria-describedby (hint, error) and aria-invalid. The working form at the end validates on blur."
    >
      <ThemePair>
        <Sample label="Default">
          <FieldSample label="First name" />
        </Sample>
        <Sample label="With hint">
          <FieldSample
            label="Company name"
            hint="The name your customers will see."
          />
        </Sample>
        <Sample label="With error">
          <FieldSample
            label="Email"
            defaultValue="name@"
            error="Enter a valid email address."
          />
        </Sample>
        <Sample label="With hint and error">
          <FieldSample
            label="Password"
            hint="At least 12 characters."
            defaultValue="short"
            error="Use at least 12 characters."
          />
        </Sample>
        <Sample label="Optional">
          <FieldSample label="Company website" isOptional />
        </Sample>
        <Sample label="Disabled">
          <FieldSample
            label="Email"
            defaultValue="name@company.com"
            isDisabled
          />
        </Sample>
        <Sample label="Long error text (wraps, never truncates)">
          <FieldSample
            label="Display name"
            defaultValue="***"
            error={LONG_ERROR}
          />
        </Sample>
        <Sample label="Working form (React Hook Form, validates on blur)">
          <LiveForm />
        </Sample>
      </ThemePair>
    </Subsection>
  );
}
