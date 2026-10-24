import { z } from "zod";
import {
  commitMediaUpload,
  currentMessage,
  messageUrl,
  orderForMessages,
  qrSvg,
  saveTextMessage,
  startMediaUpload,
} from "@/lib/messages";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, readJson, tooMany } from "@/lib/http";

// The buyer's side of QR messages. Authorised by the order's tracking token
// (from the confirmation email or the thank-you page).
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), orderId: z.string().max(20), token: z.string().max(64) }),
  z.object({ action: z.literal("text"), orderId: z.string().max(20), token: z.string().max(64), body: z.string().max(4000) }),
  z.object({
    action: z.literal("upload"),
    orderId: z.string().max(20),
    token: z.string().max(64),
    mimeType: z.string().max(100),
    size: z.number().int().positive(),
  }),
  z.object({ action: z.literal("commit"), orderId: z.string().max(20), token: z.string().max(64), messageId: z.string().max(64) }),
]);

export async function POST(req: Request) {
  try {
    const wait = await rateLimit(LIMITS.messages, clientIp(req.headers));
    if (wait) return tooMany(wait);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
    const p = parsed.data;
    const order = await orderForMessages(p.orderId, p.token);

    if (p.action === "upload") return json(await startMediaUpload(order, p.mimeType, p.size));
    if (p.action === "text") await saveTextMessage(order, p.body);
    if (p.action === "commit") await commitMediaUpload(order, p.messageId);

    const m = await currentMessage(order.id);
    return json({
      message: m
        ? {
            kind: m.kind,
            text: m.body ?? null,
            url: messageUrl(m.id, order.siteOrigin),
            qrSvg: await qrSvg(messageUrl(m.id, order.siteOrigin)),
            createdAt: m.createdAt,
          }
        : null,
      recipient: order.recipient.name,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
