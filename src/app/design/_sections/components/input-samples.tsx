import {
  Sample,
  Subsection,
  ThemePair,
} from "@/app/design/_components/section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Design system 4.2 and 4.3. The focused state is live (Tab or click). */
export function InputSamples() {
  return (
    <>
      <Subsection
        title="Input"
        description="Focus-visible is live: click or Tab into any field to see the border and ring."
      >
        <ThemePair>
          <Sample label="Default with placeholder">
            <Input aria-label="Default input" placeholder="name@company.com" />
          </Sample>
          <Sample label="Filled">
            <Input aria-label="Filled input" defaultValue="Ada Lovelace" />
          </Sample>
          <Sample label="Focus me (live focus-visible)">
            <Input
              aria-label="Focus sample input"
              placeholder="Click or Tab here"
            />
          </Sample>
          <Sample label="Invalid (aria-invalid)">
            <Input
              aria-label="Invalid input"
              aria-invalid="true"
              defaultValue="not-an-email"
            />
          </Sample>
          <Sample label="Disabled">
            <Input
              aria-label="Disabled input"
              disabled
              defaultValue="Cannot edit"
            />
          </Sample>
          <Sample label="Read-only">
            <Input
              aria-label="Read-only input"
              readOnly
              defaultValue="Read-only value"
            />
          </Sample>
          <Sample label="Long value">
            <Input
              aria-label="Long value input"
              defaultValue="a-very-long-value-that-keeps-going-and-going-to-prove-the-input-never-widens-its-container@example.com"
            />
          </Sample>
        </ThemePair>
      </Subsection>
      <Subsection title="Label">
        <ThemePair>
          <Sample label="Normal">
            <Label>Email address</Label>
          </Sample>
          <Sample label="Optional marker">
            <Label isOptional>Company website</Label>
          </Sample>
          <Sample label="Long label (wraps)">
            <Label>
              The email address we should use for invoices, receipts and any
              other billing correspondence about your subscription
            </Label>
          </Sample>
        </ThemePair>
      </Subsection>
    </>
  );
}
