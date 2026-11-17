/**
 * A bot's digest — see `.fork/customizations.yaml#fork-bot-digest`. The bot keeps DIGEST.md in its
 * folder (Needs you, New, In progress); the Threads panel shows its sections with something in
 * them, one line per item, with the threads and pull requests the line links.
 */
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { replaceThreadLinks, type ThreadLink } from "@t3tools/shared/threadLinks";

export interface BotDigestPullRequest {
  readonly url: string;
  readonly number: number;
}

export interface BotDigestItem {
  /** The line as plain words: list marker, emphasis and link targets dropped. */
  readonly text: string;
  /** The line as the bot wrote it, links kept, less its list marker. */
  readonly source: string;
  readonly threads: ReadonlyArray<ThreadLink>;
  readonly pullRequests: ReadonlyArray<BotDigestPullRequest>;
}

export interface BotDigestSection {
  readonly title: string;
  readonly items: ReadonlyArray<BotDigestItem>;
}

const EMPTY_ITEM = /^(nothing|none)( yet)?\.?$/i;
const LABELED_URL = /\[([^\]\n]*)\]\(<?(https?:\/\/[^\s<>()]+)>?\)/g;
const BARE_URL = /<?(https?:\/\/[^\s<>()[\]]+)>?/g;

const unmarked = (line: string) =>
  line
    .replace(/^(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .trim();

const pullRequestNumber = (url: string) =>
  sourceControlClients.parseChangeRequestUrl(url)?.link.number ?? null;

/** Each link while a line is read: the words it reads as inline, or nothing at the line's end. */
const LINK_TOKEN = /\{\{link:(\d+)\}\}/g;
/** One link ending a line, with what separates it from the words before. Links ending a line
    name what it is about, which the row under it shows instead. */
const TRAILING_LINK = /[\s,;:\u2013\u2014-]*[([]?\{\{link:\d+\}\}[)\]]?[\s.]*$/;

/** Drops the links that end a line one at a time; one pattern for the run backtracks badly. */
function withoutTrailingLinks(text: string): string {
  let rest = text;
  for (
    let next = rest.replace(TRAILING_LINK, "");
    next !== rest;
    next = rest.replace(TRAILING_LINK, "")
  ) {
    rest = next;
  }
  return rest;
}

/** One line as plain words, and the threads and pull requests it links. A link inside the line
    reads as its label (a bare pull request as its number); the links that end it are dropped. */
function parseItem(line: string): BotDigestItem {
  const source = unmarked(line);
  const threads: ThreadLink[] = [];
  const pullRequests: BotDigestPullRequest[] = [];
  const words: string[] = [];
  const token = (inline: string) => `{{link:${words.push(inline) - 1}}}`;
  const addPullRequest = (url: string, number: number) => {
    if (!pullRequests.some((pullRequest) => pullRequest.url === url)) {
      pullRequests.push({ url, number });
    }
  };
  const linked = replaceThreadLinks(source, (link, label) => {
    if (
      !threads.some((t) => t.threadId === link.threadId && t.environmentId === link.environmentId)
    ) {
      threads.push(link);
    }
    return token(label?.trim() ?? "");
  })
    .replace(LABELED_URL, (source: string, label: string, url: string) => {
      const number = pullRequestNumber(url);
      if (number === null) return source;
      addPullRequest(url, number);
      return token(label);
    })
    .replace(BARE_URL, (source: string, written: string) => {
      // A sentence's closing punctuation is not part of the URL.
      const url = written.replace(/[.,;:!?]+$/, "");
      const number = pullRequestNumber(url);
      if (number === null) return source;
      addPullRequest(url, number);
      return token(`#${number}`) + written.slice(url.length);
    });
  const text = withoutTrailingLinks(linked)
    .replace(LINK_TOKEN, (_, index: string) => words[Number(index)] ?? "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
  return { text, source, threads, pullRequests };
}

/** The sections of a DIGEST.md that hold anything, in the file's order. A level-two or deeper
    heading starts a section; text before the first one (the title) is left out. */
export function parseBotDigest(contents: string): ReadonlyArray<BotDigestSection> {
  const sections: Array<{ title: string; items: BotDigestItem[] }> = [];
  let current: { title: string; items: BotDigestItem[] } | null = null;
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{2,6}\s+(.+?)\s*#*$/.exec(line);
    if (heading?.[1] !== undefined) {
      current = { title: parseItem(heading[1]).text, items: [] };
      sections.push(current);
      continue;
    }
    // Skips a level-one heading; a "#" with no space after it starts an item.
    if (current === null || line === "" || /^#\s/.test(line)) continue;
    const item = parseItem(line);
    const linked = item.threads.length > 0 || item.pullRequests.length > 0;
    // A repeated line says nothing new, and each line keys its row.
    if (
      (item.text !== "" || linked) &&
      !EMPTY_ITEM.test(item.text) &&
      !current.items.some((other) => other.source === item.source)
    ) {
      current.items.push(item);
    }
  }
  return sections.filter((section) => section.items.length > 0);
}

/** Names a section as it reads now: a card dismissed under it comes back once its items change. */
export function botDigestSectionKey(section: BotDigestSection): string {
  return [section.title, ...section.items.map((item) => item.source)].join("\n");
}
