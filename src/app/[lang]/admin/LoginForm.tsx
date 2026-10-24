"use client";

import { useActionState, useSyncExternalStore } from "react";
import { login } from "./actions";

const noop = () => () => {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  // After logging in, come back to this exact page (deep links from emails).
  const next = useSyncExternalStore(noop, () => window.location.pathname, () => "/admin/");
  return (
    <form action={action} className="mx-auto max-w-sm space-y-4 rounded-3xl p-6 ring-1 ring-black/10">
      <h1 className="text-3xl">Admin GiftMe!</h1>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="password" className="mb-1 block font-medium">
          Parola
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-black/25 px-4 py-3"
        />
      </div>
      {state.error && (
        <p role="alert" className="font-medium text-red-dark">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Se verifică…" : "Intră"}
      </button>
    </form>
  );
}
