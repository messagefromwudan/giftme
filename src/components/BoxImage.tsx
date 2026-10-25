import Image from "next/image";
import type { Box, Locale } from "@/lib/catalog";
import { BoxArt } from "./BoxArt";

/**
 * The box photo through next/image (AVIF/WebP, sized by `sizes`), or the illustrated
 * placeholder for a box that has no photo yet.
 *
 * - "cover": fills the frame set by `className` (aspect ratio or fixed size), cropping the edges.
 * - "natural": full width at the photo's own aspect ratio, nothing cropped (the box page).
 *
 * `decorative` hides the image from screen readers where the box name sits right next to it.
 */
export function BoxImage({
  box,
  lang,
  sizes,
  className = "",
  fit = "cover",
  decorative = false,
  eager = false,
}: {
  box: Box;
  lang: Locale;
  sizes: string;
  className?: string;
  fit?: "cover" | "natural";
  decorative?: boolean;
  /** Above the fold: load at once with high priority (the box page's main photo). */
  eager?: boolean;
}) {
  const photo = box.photo;
  if (!photo) {
    return (
      <BoxArt
        box={box}
        label={decorative ? "" : box.name}
        crop={fit === "cover"}
        className={fit === "natural" ? `aspect-square w-full ${className}` : className}
      />
    );
  }
  const alt = decorative ? "" : photo.alt[lang];
  const loading = eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {};
  if (fit === "natural") {
    return (
      <Image
        src={photo.src}
        width={photo.width}
        height={photo.height}
        alt={alt}
        sizes={sizes}
        className={`h-auto w-full bg-cream ${className}`}
        {...loading}
      />
    );
  }
  return (
    <div className={`relative overflow-hidden bg-cream ${className}`}>
      <Image src={photo.src} alt={alt} fill sizes={sizes} className="object-cover" {...loading} />
    </div>
  );
}
