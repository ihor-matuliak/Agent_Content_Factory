/**
 * Loads configuration from the repository-root .env file and exposes it as a
 * typed `env` object. All secrets live in .env (never hardcoded).
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
// apps/backend/src/env.ts -> repo root is three levels up.
const repoRoot = resolve(__dirname, "..", "..", "..");

dotenv.config({ path: resolve(repoRoot, ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  backendPort: Number(process.env.BACKEND_PORT ?? 4000),
  /** OAuth token for the Claude Agent SDK (preferred auth). */
  claudeOAuthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN ?? "",
  /** Anthropic API key — fallback auth when no OAuth token is set. */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  /** Model the agents use. */
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  /** Telegram bot token for owner notifications (optional). */
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  /** Telegram chat id of the owner to notify (optional). */
  telegramOwnerChatId: process.env.TELEGRAM_OWNER_CHAT_ID ?? "",
} as const;

/** True when Telegram notifications are fully configured. */
export const hasTelegram = Boolean(
  env.telegramBotToken && env.telegramOwnerChatId,
);

/** True when at least one valid Claude credential is configured. */
export const hasClaudeCredential = Boolean(
  env.claudeOAuthToken || env.anthropicApiKey,
);
