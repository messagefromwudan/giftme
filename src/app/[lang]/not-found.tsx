import Link from "next/link";
import { getDict } from "@/i18n";
import { PageShell } from "@/components/PageShell";

// Rendered in Romanian: not-found has no access to the route params.
export default function NotFound() {
  const t = getDict("ro").notFound;
  return (
    <PageShell lang="ro" altHref="/en/">
      <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
        <p className="hand text-7xl text-red">404</p>
        <h1 className="mt-4 text-4xl sm:text-5xl">{t.title}</h1>
        <p className="mt-4 text-lg text-muted">{t.copy}</p>
        <Link href="/#cutii" className="btn btn-primary mt-8">
          {t.cta}
        </Link>
      </section>
    </PageShell>
  );
}
