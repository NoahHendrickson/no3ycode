/**
 * The wake marker on a bot's own tasks — see `.fork/customizations.yaml#fork-bots`. The MCP tools
 * put it in front of every prompt a bot's own task sends, so the bot can tell a wake from its
 * owner.
 */
const FORK_BOT_WAKE_MARKER = "Scheduled wake:";

/** The prompt with the wake marker in front, once. */
export function forkBotWakePrompt(prompt: string): string {
  return prompt.trimStart().startsWith(FORK_BOT_WAKE_MARKER)
    ? prompt
    : `${FORK_BOT_WAKE_MARKER} ${prompt}`;
}
