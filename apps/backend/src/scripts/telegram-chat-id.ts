/**
 * Helper: print the chat id(s) that have messaged your Telegram bot.
 *
 * Usage:
 *   1. Set TELEGRAM_BOT_TOKEN in .env.
 *   2. Open Telegram, find your bot, and send it any message (e.g. "hi").
 *   3. Run `npm run telegram:chat-id` and copy the printed id into
 *      TELEGRAM_OWNER_CHAT_ID in .env.
 */
import { env } from "../env.js";

async function main(): Promise<void> {
  if (!env.telegramBotToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set in .env. Set it and try again.");
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${env.telegramBotToken}/getUpdates`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Telegram API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const data = (await res.json()) as {
    ok: boolean;
    result: Array<{
      message?: { chat?: { id: number; type: string; first_name?: string; title?: string } };
    }>;
  };

  const chats = new Map<number, string>();
  for (const update of data.result ?? []) {
    const chat = update.message?.chat;
    if (chat) {
      chats.set(chat.id, chat.title ?? chat.first_name ?? chat.type);
    }
  }

  if (chats.size === 0) {
    console.log(
      "No chats found. Send your bot a message in Telegram first, then re-run this command.",
    );
    return;
  }

  console.log("Chats that have messaged your bot:\n");
  for (const [id, label] of chats) {
    console.log(`  ${id}  (${label})`);
  }
  console.log("\nCopy the id you want into TELEGRAM_OWNER_CHAT_ID in .env.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
