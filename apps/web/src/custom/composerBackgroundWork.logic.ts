const LEADING_CD = /^cd\s+(?:"[^"]*"|'[^']*'|\S+)\s*(?:&&|;)\s*/u;
const TRAILING_REDIRECT = /\s+(?:\d?>&\d|&>\s*\S+|\d?>>?\s*\S+|&)\s*$/u;

/** Whether a shell string ends outside any quote: tracks the open quote, and a backslash escapes
 * the next character everywhere but inside single quotes. */
function endsUnquoted(text: string): boolean {
  let quote: string | null = null;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\\" && quote !== "'") index++;
    else if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
  }
  return quote === null;
}

/** A background command as its gist for the work list: no `cd <dir> &&` lead-in, no trailing
 * output redirects. `vp run dev --no-seed 2>&1` reads `vp run dev --no-seed`. A cut that would
 * split a quoted string is not made. */
export function glanceCommandLabel(command: string): string {
  let label = command.trim();
  // The quote scan cannot follow quotes nested in a command substitution.
  if (label.includes("$(") || label.includes("`")) return label;
  for (let previous = ""; previous !== label;) {
    previous = label;
    for (const pattern of [LEADING_CD, TRAILING_REDIRECT]) {
      const next = label.replace(pattern, "").trim();
      if (next.length > 0 && endsUnquoted(next)) label = next;
    }
  }
  return label;
}
