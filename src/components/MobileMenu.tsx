"use client";

import { useEffect, useRef, useState } from "react";

/** Mobile navigation: a three-line button; closes on a tap outside, Escape or choosing a link. */
export function MobileMenu({
  links,
  navLabel,
  openLabel,
  closeLabel,
}: {
  links: { href: string; label: string }[];
  navLabel: string;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const bar = "absolute left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-white transition-all duration-200";

  return (
    <div ref={root} className="relative lg:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink"
      >
        <span aria-hidden="true" className={`${bar} ${open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-[13px]"}`} />
        <span aria-hidden="true" className={`${bar} top-1/2 -translate-y-1/2 ${open ? "opacity-0" : ""}`} />
        <span aria-hidden="true" className={`${bar} ${open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-[13px]"}`} />
      </button>
      {open && (
        <nav
          id="mobile-menu"
          aria-label={navLabel}
          className="absolute right-0 top-12 w-60 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/10"
        >
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 font-medium hover:bg-blush">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
