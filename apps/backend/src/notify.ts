/**
 * Optional Telegram notifications for the swarm owner.
 *
 * When TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID are set in .env, the owner
 * gets a message when a plan is ready to launch or a run finishes. When they are
 * not set, every call here is a silent no-op — the swarm works fine without it.
 *
 * Find your chat id with: `npm run telegram:chat-id`
 */
import { env, hasTelegram } from "./env.js";

/**
 * Send a notification to the owner. Returns true if it was actually sent.
 * Never throws — a failed notification must not break a run.
 */
export async function notifyOwner(title: string, body = ""): Promise<boolean> {
  if (!hasTelegram) return false;

  const text = body ? `*${title}*\n${body}` : `*${title}*`;
  const url = `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.telegramOwnerChatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    if (!res.ok) {
      console.error(`[notify] Telegram responded ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] failed to send Telegram message:", err);
    return false;
  }
}
