/**
 * A bot's digest — see `.fork/customizations.yaml#fork-bot-digest`. The bot keeps DIGEST.md in its
 * folder (Needs you, New, In progress); the Threads panel shows its sections with something in
 * them, one line per item.
 */

export interface BotDigestSection {
  readonly title: string;
  readonly items: ReadonlyArray<string>;
  /** Decisions only the owner can make, drawn first and brightest. */
  readonly needsYou: boolean;
}

const EMPTY_ITEM = /^(nothing|none)( yet)?\.?$/i;

/** One item as plain words: list marker, emphasis and link targets dropped. */
function plainItem(line: string): string {
  return line
    .replace(/^(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .trim();
}

/** The sections of a DIGEST.md that hold anything, in the file's order. A level-two or deeper
    heading starts a section; text before the first one (the title) is left out. */
export function parseBotDigest(contents: string): ReadonlyArray<BotDigestSection> {
  const sections: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{2,6}\s+(.+?)\s*#*$/.exec(line);
    if (heading?.[1] !== undefined) {
      current = { title: plainItem(heading[1]), items: [] };
      sections.push(current);
      continue;
    }
    // Skips a level-one heading; a "#" with no space after it starts an item.
    if (current === null || line === "" || /^#\s/.test(line)) continue;
    const item = plainItem(line);
    // A repeated line says nothing new, and each line keys its row.
    if (item !== "" && !EMPTY_ITEM.test(item) && !current.items.includes(item)) {
      current.items.push(item);
    }
  }
  return sections
    .filter((section) => section.items.length > 0)
    .map((section) => ({ ...section, needsYou: /^needs you$/i.test(section.title) }));
}
