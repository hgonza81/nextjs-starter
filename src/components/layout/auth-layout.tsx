import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthLayoutProps = {
  /** The page `h1`, for example "Create your account". */
  title: string;
  description?: string;
  /** The form (or other content) inside the card. */
  children: ReactNode;
  /** The single alternative-action line, for example a link to log in. */
  footer?: ReactNode;
};

/**
 * The one layout for sign-up, login and later reset flows (design system 5.1):
 * wordmark above a centered card on the canvas background. The card area is the
 * `main` landmark and its title is the page `h1`.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 bg-canvas px-4 py-8 md:justify-center md:py-12">
      <header>
        <Link href="/" className="rounded-sm text-xl focus-ring">
          <Wordmark />
        </Link>
      </header>
      <main className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle as="h1" className="text-2xl tracking-tight">
              {title}
            </CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer ? (
            <CardFooter className="justify-center text-sm text-muted-foreground">
              {footer}
            </CardFooter>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
