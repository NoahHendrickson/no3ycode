/**
 * The wake marker on a bot's own tasks — see `.fork/customizations.yaml#fork-bots`. The MCP tools
 * put it in front of every prompt a bot's own task sends, so the bot can tell a wake from its
 * owner, and the scheduler knows a bot's wake without looking up its thread.
 */
const FORK_BOT_WAKE_MARKER = "Scheduled wake:";

/** Whether a stored task prompt is a bot's: only a bot's own task is saved with the marker. */
export function forkBotTaskPrompt(prompt: string): boolean {
  return prompt.trimStart().startsWith(FORK_BOT_WAKE_MARKER);
}

/** The prompt with the wake marker in front, once. */
export function forkBotWakePrompt(prompt: string): string {
  return forkBotTaskPrompt(prompt) ? prompt : `${FORK_BOT_WAKE_MARKER} ${prompt}`;
}
