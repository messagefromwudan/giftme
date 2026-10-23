import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE, type Locale } from "./catalog";

export const ogSize = { width: 1200, height: 630 };

const font = (file: string) => readFile(join(process.cwd(), "src/assets/fonts", file));

async function fonts() {
  const [sp, spx, po, pox, ca, cax] = await Promise.all([
    font("league-spartan-latin-900-normal.woff"),
    font("league-spartan-latin-ext-900-normal.woff"),
    font("poppins-latin-500-normal.woff"),
    font("poppins-latin-ext-500-normal.woff"),
    font("caveat-latin-700-normal.woff"),
    font("caveat-latin-ext-700-normal.woff"),
  ]);
  return [
    { name: "Spartan", data: sp, weight: 900 as const },
    { name: "Spartan", data: spx, weight: 900 as const },
    { name: "Poppins", data: po, weight: 500 as const },
    { name: "Poppins", data: pox, weight: 500 as const },
    { name: "Caveat", data: ca, weight: 700 as const },
    { name: "Caveat", data: cax, weight: 700 as const },
  ];
}

/** Shared social card: black background, red accent, a simple gift box drawn with divs. */
export async function ogCard({
  lang,
  eyebrow,
  title,
  accent,
  footer,
}: {
  lang: Locale;
  eyebrow: string;
  title: string;
  accent?: string;
  footer?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#111111",
          color: "#ffffff",
          padding: 72,
          fontFamily: "Poppins",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, color: "#ff8a92", textTransform: "uppercase" }}>
            {eyebrow}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Spartan", fontSize: title.length > 18 ? 76 : 96, lineHeight: 1, maxWidth: 680 }}>
              {title}
            </div>
            {accent && (
              <div style={{ fontFamily: "Caveat", fontSize: 64, color: "#e11d2e", marginTop: 16 }}>{accent}</div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#c9c4c4" }}>
            {footer ?? `giftme.site · ${SITE.slogan[lang]}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 340 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: "rotate(4deg)" }}>
            <div style={{ display: "flex", width: 300, height: 64, background: "#ffffff", borderRadius: 16, justifyContent: "center" }}>
              <div style={{ width: 40, height: 64, background: "#e11d2e" }} />
            </div>
            <div style={{ display: "flex", width: 260, height: 230, background: "#fdeced", borderRadius: 18, justifyContent: "center" }}>
              <div style={{ width: 40, height: 230, background: "#e11d2e" }} />
            </div>
          </div>
        </div>
      </div>
    ),
    { ...ogSize, fonts: await fonts() },
  );
}
