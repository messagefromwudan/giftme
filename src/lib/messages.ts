import "server-only";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { RULES } from "./catalog";
import { orderBaseUrl } from "./origin";
import { createPassItOnCode } from "./codes";
import { db } from "./db";
import { findOrderForCustomer, OrderError, type Order } from "./orders";

// QR messages: the buyer records audio/video (or writes text); the recipient scans the QR code
// on the box and opens /mesaj/[id]. Media lives in the private `messages` bucket and is only
// served through short-lived signed URLs. Everything is deleted 30 days after the recipient
// reveals their PASS-IT-ON code.

export type Message = {
  /** Long and unguessable: it is the only key to /mesaj/[id]. */
  id: string;
  orderId: string;
  kind: "audio" | "video" | "text";
  body?: string;
  /** Set only once the upload is verified. */
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
  revealedAt?: string;
  passCode?: string;
  deleteAfter?: string;
};

export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const MAX_TEXT_CHARS = 2000;
/** Signed media links expire quickly; the page asks for a fresh one on every visit. */
export const SIGNED_URL_SECONDS = 600;

const MEDIA_TYPES: Record<string, { kind: "audio" | "video"; ext: string }> = {
  "audio/webm": { kind: "audio", ext: "webm" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "audio/wav": { kind: "audio", ext: "wav" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/quicktime": { kind: "video", ext: "mov" },
};

/** "audio/webm;codecs=opus" → "audio/webm". */
export const baseMime = (m: string) => m.split(";")[0].trim().toLowerCase();

export const messageUrl = (id: string, siteOrigin?: string) => `${orderBaseUrl(siteOrigin)}/mesaj/${id}/`;

export const isReady = (m: Message) => m.kind === "text" ? Boolean(m.body) : Boolean(m.storagePath);

/** The buyer proves ownership with the tracking token from their confirmation email. */
export async function orderForMessages(orderId: string, token: string): Promise<Order> {
  const order = await findOrderForCustomer(orderId, { token });
  if (!order) throw new OrderError("NOT_FOUND", "No order matches this link");
  if (order.status === "awaiting_approval") throw new OrderError("NOT_CONFIRMED", "Confirm the order first");
  if (order.status === "cancelled") throw new OrderError("CANCELLED", "This order was cancelled");
  return order;
}

export async function currentMessage(orderId: string): Promise<Message | null> {
  return (await db().messagesForOrder(orderId)).find(isReady) ?? null;
}

/** Keep only `keep`: removes older messages of the order and their files. */
async function removeOthers(orderId: string, keepId: string) {
  const others = (await db().messagesForOrder(orderId)).filter((m) => m.id !== keepId);
  await db().media.remove(others.flatMap((m) => (m.storagePath ? [m.storagePath] : [])));
  for (const m of others) await db().deleteMessage(m.id);
}

const newId = () => randomBytes(24).toString("base64url");

export async function saveTextMessage(order: Order, body: string) {
  const text = body.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim();
  if (text.length < 1 || text.length > MAX_TEXT_CHARS) {
    throw new OrderError("INVALID_TEXT", `Message must be 1–${MAX_TEXT_CHARS} characters`);
  }
  const m: Message = { id: newId(), orderId: order.id, kind: "text", body: text, createdAt: new Date().toISOString() };
  await db().insertMessage(m);
  await removeOthers(order.id, m.id);
  return m;
}

/** Step 1 of a media upload: a one-time signed upload URL into the private bucket. */
export async function startMediaUpload(order: Order, mimeType: string, size: number) {
  const type = MEDIA_TYPES[baseMime(mimeType)];
  if (!type) throw new OrderError("UNSUPPORTED_TYPE", "Only audio or video files are accepted");
  if (!Number.isInteger(size) || size <= 0 || size > MAX_MEDIA_BYTES) {
    throw new OrderError("TOO_LARGE", `Files up to ${MAX_MEDIA_BYTES / 1024 / 1024} MB`);
  }
  const m: Message = {
    id: newId(),
    orderId: order.id,
    kind: type.kind,
    mimeType: baseMime(mimeType),
    sizeBytes: size,
    createdAt: new Date().toISOString(),
  };
  await db().insertMessage(m);
  const path = `${order.id}/${m.id}.${type.ext}`;
  const upload = await db().media.uploadUrl(path);
  return { messageId: m.id, uploadUrl: upload.signedUrl, contentType: m.mimeType };
}

/** Step 2: confirm the file really arrived, then make it the order's message. */
export async function commitMediaUpload(order: Order, messageId: string) {
  const m = await db().getMessage(messageId);
  if (!m || m.orderId !== order.id || m.kind === "text") throw new OrderError("NOT_FOUND", "Unknown upload");
  const ext = MEDIA_TYPES[m.mimeType ?? ""]?.ext;
  const path = `${order.id}/${m.id}.${ext}`;
  try {
    await db().media.signedUrl(path, 30); // fails if the object does not exist
  } catch {
    throw new OrderError("UPLOAD_MISSING", "The file did not arrive; please try again");
  }
  m.storagePath = path;
  await db().saveMessage(m);
  await removeOthers(order.id, m.id);
  return m;
}

/** What the recipient sees on /mesaj/[id]. Media comes as a fresh short-lived signed URL. */
export async function messageForRecipient(id: string) {
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(id)) return null;
  const m = await db().getMessage(id);
  if (!m || !isReady(m)) return null;
  const order = await db().getOrder(m.orderId);
  if (!order || order.status === "cancelled") return null;
  const mediaUrl = m.storagePath ? await db().media.signedUrl(m.storagePath, SIGNED_URL_SECONDS) : null;
  return {
    id: m.id,
    kind: m.kind,
    text: m.body ?? null,
    mediaUrl,
    mimeType: m.mimeType ?? null,
    recipient: order.recipient.name,
    occasion: order.personalization.occasion,
    lang: order.lang,
    passCode: m.passCode ? { code: m.passCode, expiresAt: m.deleteAfter } : null,
  };
}

/** "Dăruiește mai departe": one PASS-IT-ON code per message, valid 30 days; starts retention. */
export async function revealPassCode(id: string) {
  const m = await db().getMessage(id);
  if (!m || !isReady(m)) throw new OrderError("NOT_FOUND", "Unknown message");
  if (m.passCode) {
    const code = await db().getCode(m.passCode);
    return { code: m.passCode, expiresAt: code?.expiresAt ?? m.deleteAfter };
  }
  const now = new Date();
  const rec = await createPassItOnCode(m.orderId, 30, now);
  m.passCode = rec.code;
  m.revealedAt = now.toISOString();
  m.deleteAfter = new Date(now.getTime() + RULES.dataRetentionDaysAfterReveal * 86_400_000).toISOString();
  await db().saveMessage(m);
  return { code: rec.code, expiresAt: rec.expiresAt };
}

/** Daily cron: delete messages (and files) whose retention period is over. */
export async function deleteExpiredMessages(now = new Date()) {
  const expired = await db().expiredMessages(now);
  await db().media.remove(expired.flatMap((m) => (m.storagePath ? [m.storagePath] : [])));
  for (const m of expired) await db().deleteMessage(m.id);
  return expired.length;
}

export async function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });
}
