import { siFacebook, siInstagram, siTiktok } from "simple-icons";

const ICONS = { instagram: siInstagram, tiktok: siTiktok, facebook: siFacebook };

/** Decorative: the visible @handle is the link text. */
export function SocialIcon({ id }: { id: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0 fill-current">
      <path d={ICONS[id].path} />
    </svg>
  );
}
