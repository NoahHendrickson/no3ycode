/**
 * A bot that keeps failing the same way alerts once — see `.fork/customizations.yaml#fork-bots`.
 * Every wake is a fresh run, so a bot whose sign-in expired would otherwise alert on every wake.
 * It alerts again when the error changes or after a wake succeeds. Per client session.
 */

/** An error's wording without what changes on every run: ids, timestamps and long numbers.
    Short numbers stay, so HTTP 401 and 429 read as different failures. */
export function botFailureSignature(error: string | null): string {
  return (error ?? "")
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}[t ][\d:.]+z?/g, "<time>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/g, "<id>")
    .replace(/\b[0-9a-f]{12,}\b/g, "<id>")
    .replace(/\d{4,}/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

export function createBotFailureAlerts<Key>() {
  const alerted = new Map<Key, string>();
  return {
    /** The attention to announce for a bot: unchanged, except a failure that repeats the last
        one it alerted is quiet. A wake that succeeds forgets it. */
    attention(
      key: Key,
      input: {
        readonly attention: string | null;
        readonly failed: boolean;
        readonly succeeded: boolean;
        readonly error: string | null;
      },
    ): string | null {
      if (input.succeeded) alerted.delete(key);
      if (!input.failed || input.attention === null) return input.attention;
      const signature = botFailureSignature(input.error);
      if (alerted.get(key) === signature) return null;
      alerted.set(key, signature);
      return input.attention;
    },
    retain(keys: ReadonlySet<Key>): void {
      for (const key of alerted.keys()) if (!keys.has(key)) alerted.delete(key);
    },
  };
}
