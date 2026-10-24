"use client";

import Link from "next/link";

// Friendly error page for the public site (instead of a blank crash).
export default function SiteError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="hand text-6xl text-red">Oops!</p>
      <h1 className="mt-3 text-3xl">Ceva nu a mers / Something went wrong</h1>
      <p className="mt-3 text-muted">Încearcă din nou peste câteva secunde. / Please try again in a few seconds.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          Încearcă din nou
        </button>
        <Link href="/" className="btn btn-ghost">
          GiftMe!
        </Link>
      </div>
    </main>
  );
}
