import type { Locale } from "./catalog";

// Personal details typed by mistake never reach the AI model: every AI feature that sends
// visitor text to the model (chat widget, Harta emoției) passes it through here first.

export function redactPersonal(text: string, lang: Locale): string {
  const [email, phone] = lang === "ro" ? ["[email ascuns]", "[telefon ascuns]"] : ["[email hidden]", "[phone hidden]"];
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, email)
    .replace(/\+?\d[\d\s().-]{6,}\d/g, (m) => (m.replace(/\D/g, "").length >= 8 ? phone : m));
}
