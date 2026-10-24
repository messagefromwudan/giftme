import "server-only";
import { db } from "./db";
import { deleteExpiredMessages, deleteUnrevealedMessages } from "./messages";

type Step = "ping" | "cleanup" | "expiredMessages" | "unrevealedMessages";

/**
 * The daily cron's work. Every step runs on its own: an error in one is logged and reported
 * but never stops the others (keep-alive ping, rate-limit/idempotency cleanup, the 30-day
 * message deletion, and the never-revealed deletion from RULES.unrevealedMessagesDeleteOn).
 */
export async function runDailyCleanup(now = new Date()) {
  const failed: Step[] = [];
  const step = async <T>(name: Step, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      console.error(`[cron daily] ${name} failed:`, e);
      failed.push(name);
      return null;
    }
  };
  await step("ping", () => db().ping());
  const cleanup = await step("cleanup", () => db().cleanup());
  const messages = await step("expiredMessages", () => deleteExpiredMessages(now));
  const unrevealedMessages = await step("unrevealedMessages", () => deleteUnrevealedMessages(now));
  return { ok: failed.length === 0, failed, cleaned: { ...cleanup, messages, unrevealedMessages } };
}
