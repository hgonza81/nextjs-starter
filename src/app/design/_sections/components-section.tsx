import { Section } from "@/app/design/_components/section";
import {
  AlertSamples,
  CardSamples,
} from "@/app/design/_sections/components/alert-card-samples";
import { ButtonSamples } from "@/app/design/_sections/components/button-samples";
import {
  LinkSamples,
  SpinnerSkeletonSamples,
  ToastSamples,
} from "@/app/design/_sections/components/feedback-samples";
import { FormFieldSamples } from "@/app/design/_sections/components/form-field-samples";
import { InputSamples } from "@/app/design/_sections/components/input-samples";
import { PasswordSamples } from "@/app/design/_sections/components/password-samples";

/** Section 7 of the content spec: one subsection per component. */
export function ComponentsSection() {
  return (
    <Section
      id="components"
      title="Components"
      description="Each component in every state the design system lists, in both themes. PageHeader and the two layouts are in the Layouts section, because a page header is an h1 and this page already has one."
    >
      <ButtonSamples />
      <InputSamples />
      <FormFieldSamples />
      <PasswordSamples />
      <AlertSamples />
      <CardSamples />
      <SpinnerSkeletonSamples />
      <ToastSamples />
      <LinkSamples />
    </Section>
  );
}
