import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogDocument } from "./agent";
import { llmsFullTxt } from "./agent-docs";
import { BOXES, SITE } from "./catalog";

/** Width and height from a baseline/progressive JPEG's SOF marker. */
function jpegSize(buf: Buffer) {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("no SOF marker");
}

describe("box photos", () => {
  it("GM-01…GM-08 have a photo; GM-09 keeps the illustration", () => {
    for (const b of BOXES) expect(Boolean(b.photo), b.id).toBe(b.id !== "GM-09");
  });

  it("every photo file exists in /public with the width and height the catalog declares", () => {
    for (const b of BOXES) {
      if (!b.photo) continue;
      const file = readFileSync(join(process.cwd(), "public", b.photo.src));
      expect(jpegSize(file), b.id).toEqual({ width: b.photo.width, height: b.photo.height });
    }
  });

  it("alt text exists in both languages and names the box, never a third-party brand", () => {
    const brands = /chanel|coco|mala|biodance|rodo|sweetland|candle cycle|spotify/i;
    for (const b of BOXES) {
      if (!b.photo) continue;
      for (const alt of [b.photo.alt.ro, b.photo.alt.en]) {
        expect(alt, b.id).toContain(b.name);
        expect(alt, b.id).not.toMatch(brands);
      }
    }
  });

  it("catalog.json and llms-full.txt publish the same absolute photo URLs", () => {
    const full = llmsFullTxt();
    for (const b of catalogDocument().boxes) {
      const box = BOXES.find((x) => x.id === b.id)!;
      if (!box.photo) {
        expect(b.image).toBeNull();
        continue;
      }
      const url = `${SITE.url}${box.photo.src}`;
      expect(b.image).toMatchObject({ url, width: box.photo.width, height: box.photo.height });
      expect(full).toContain(`- Photo: ${url}`);
    }
  });
});
