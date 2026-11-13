import { PRODUCT_NAME } from "@/components/brand/wordmark";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4 py-6 text-center md:px-6 md:py-8">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        {PRODUCT_NAME}
      </h1>
      <p className="text-base text-muted-foreground">
        A multi-tenant SaaS starter.
      </p>
    </main>
  );
}
