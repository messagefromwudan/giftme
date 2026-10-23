import type { Box, Motif } from "@/lib/catalog";

// Branded illustrated placeholder used until the real box photos arrive.
// One drawing, recoloured per box, with a motif on the front and the box code on a tag.

const PALETTE: Record<Motif, { bg: string; box: string; lid: string; emblem: string }> = {
  friends: { bg: "#ffe9a8", box: "#ffffff", lid: "#ffffff", emblem: "#111111" },
  romance: { bg: "#fdeced", box: "#111111", lid: "#111111", emblem: "#e11d2e" },
  corporate: { bg: "#e6eaee", box: "#111111", lid: "#111111", emblem: "#111111" },
  creative: { bg: "#d9f2e1", box: "#ffffff", lid: "#ffffff", emblem: "#111111" },
  beauty: { bg: "#fde0e8", box: "#ffffff", lid: "#ffffff", emblem: "#e11d2e" },
  self: { bg: "#e9e3fb", box: "#ffffff", lid: "#ffffff", emblem: "#111111" },
  teacher: { bg: "#e3efd8", box: "#ffffff", lid: "#ffffff", emblem: "#111111" },
  special: { bg: "#1d1d1d", box: "#ffffff", lid: "#ffffff", emblem: "#e11d2e" },
  custom: { bg: "#e11d2e", box: "#ffffff", lid: "#ffffff", emblem: "#111111" },
};

// 24×24 stroke icons.
const ICON: Partial<Record<Motif, string>> = {
  friends: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  romance: "M12 20s-7-4.4-9-8.6A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 9 4.4C19 15.6 12 20 12 20z",
  corporate: "M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z M16 11h1.5a2.5 2.5 0 0 1 0 5H16 M8 3.5v2.5 M11 3.5v2.5 M14 3.5v2.5",
  creative: "M4 20l1.2-4.2L16 5l3 3L8.2 18.8z M13.8 7.2l3 3",
  beauty: "M12 3a6 6 0 1 1 0 12a6 6 0 1 1 0-12z M12 15v6 M9 21h6",
  self: "M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z",
  teacher: "M12 21v-9 M12 12C12 7.5 8.5 5 4.5 5c0 4 3 7 7.5 7z M12 14c0-3.5 3-5.5 7-5.5 0 3.5-3 5.5-7 5.5z",
};

export function BoxArt({
  box,
  label,
  className,
  crop,
}: {
  box: Box;
  label: string;
  className?: string;
  /** Fill a non-square frame by cropping the edges instead of letterboxing. */
  crop?: boolean;
}) {
  const p = PALETTE[box.motif];
  const icon = ICON[box.motif];
  const glyph = box.motif === "special" ? "5" : box.motif === "custom" ? "?" : null;
  return (
    <svg
      viewBox={crop ? "0 66 400 300" : "0 0 400 400"}
      preserveAspectRatio={crop ? "xMidYMid slice" : undefined}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={className}
    >
      <rect width="400" height="400" fill={p.bg} />
      {/* confetti */}
      <g fill={box.motif === "custom" || box.motif === "special" ? "#ffffff" : "#e11d2e"} opacity="0.55">
        <circle cx="58" cy="70" r="6" />
        <rect x="330" y="60" width="14" height="6" rx="3" transform="rotate(30 337 63)" />
        <circle cx="350" cy="190" r="4" />
        <rect x="40" y="220" width="14" height="6" rx="3" transform="rotate(-25 47 223)" />
        <circle cx="110" cy="40" r="3.5" />
        <circle cx="300" cy="360" r="5" />
      </g>
      {/* shadow */}
      <ellipse cx="200" cy="352" rx="128" ry="12" fill="#000" opacity="0.12" />
      {/* body */}
      <rect x="92" y="172" width="216" height="172" rx="14" fill={p.box} stroke="#111" strokeWidth="5" />
      {/* lid */}
      <rect x="74" y="134" width="252" height="50" rx="12" fill={p.lid} stroke="#111" strokeWidth="5" />
      {/* ribbon */}
      <rect x="187" y="134" width="26" height="210" fill="#e11d2e" />
      <rect x="187" y="134" width="26" height="210" fill="none" stroke="#111" strokeWidth="5" />
      {/* bow */}
      <g stroke="#111" strokeWidth="5" fill="#e11d2e" strokeLinejoin="round">
        <path d="M200 132c-26-40-74-44-76-18-2 22 44 26 76 18z" />
        <path d="M200 132c26-40 74-44 76-18 2 22-44 26-76 18z" />
        <path d="M196 132l-22 44 14-4 6 14 10-52z" />
        <path d="M204 132l22 44-14-4-6 14-10-52z" />
        <circle cx="200" cy="132" r="11" />
      </g>
      {/* emblem */}
      <circle cx="140" cy="262" r="34" fill="#fff" stroke="#111" strokeWidth="5" />
      {icon && (
        <g transform="translate(116 238) scale(2)">
          <path d={icon} fill="none" stroke={p.emblem} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {glyph && (
        <text
          x="140"
          y="281"
          textAnchor="middle"
          fontSize="54"
          fontWeight="900"
          fill={p.emblem}
          style={{ fontFamily: "var(--font-league-spartan), sans-serif" }}
        >
          {glyph}
        </text>
      )}
      {/* tag with the box code */}
      <g transform="rotate(-8 290 300)">
        <line x1="262" y1="250" x2="282" y2="282" stroke="#111" strokeWidth="3" />
        <rect x="236" y="280" width="110" height="46" rx="10" fill="#fff" stroke="#111" strokeWidth="4" />
        <text
          x="291"
          y="313"
          textAnchor="middle"
          fontSize="30"
          fill="#111"
          style={{ fontFamily: "var(--font-caveat), cursive", fontWeight: 700 }}
        >
          {box.id}
        </text>
      </g>
    </svg>
  );
}
