"use client";

import Link from "next/link";

// Last safety net for the admin: never a blank crash page.
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest) : null;
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div role="alert" className="space-y-3 rounded-2xl bg-yellow-100 p-6">
        <h1 className="text-2xl">Ceva nu a mers în panoul de administrare</h1>
        <p>Încearcă din nou. Dacă se repetă, trimite-ne codul de mai jos ca să găsim eroarea în jurnal.</p>
        {digest && <p className="font-mono text-sm">Cod: {digest}</p>}
        <div className="flex gap-3">
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            Încearcă din nou
          </button>
          <Link href="/admin/" className="btn btn-ghost">
            Lista de comenzi
          </Link>
        </div>
      </div>
    </main>
  );
}
