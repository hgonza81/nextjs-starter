import type { Metadata } from "next";

import { FieldSample } from "@/app/design/_components/field-sample";
import { FrameTheme } from "@/app/design/_components/frame-theme";
import { frameHref, parseFrameTheme } from "@/app/design/_lib/frames";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = { title: "Design: auth layout frame" };

/** The real AuthLayout with sample slot content, to be shown in an iframe. */
export default async function AuthFramePage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string | string[] }>;
}) {
  const theme = parseFrameTheme((await searchParams).theme);

  return (
    <FrameTheme theme={theme}>
      <AuthLayout
        title="Log in"
        description="Enter your details to continue."
        footer={
          <p>
            Need an account?{" "}
            <TextLink href={frameHref("auth", theme)}>Sign up</TextLink>
          </p>
        }
      >
        <form noValidate className="flex flex-col gap-6">
          <FieldSample label="Email" placeholder="name@company.com" />
          <FieldSample label="Password" kind="password" />
          <Button className="w-full">Log in</Button>
        </form>
      </AuthLayout>
    </FrameTheme>
  );
}
