/**
 * A bot's digest — see `.fork/customizations.yaml#fork-bot-digest`. The bot keeps DIGEST.md in its
 * folder (a Status line, then Needs you, New, In progress); the Threads panel shows the status and
 * its sections with something in them, one line per item, with the threads and pull requests the
 * line links and the answers an ask offers.
 */
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { parseThreadLinkHref, type ThreadLink } from "@t3tools/shared/threadLinks";

export interface BotDigestPullRequest {
  readonly url: string;
  readonly number: number;
}

export interface BotDigestItem {
  /** The line as plain words: list marker, emphasis and link targets dropped, and the links
      appended after its last sentence left to the row under it. */
  readonly text: string;
  /** The line as the bot wrote it, links kept, less its list marker. */
  readonly source: string;
  /** Each thread the line links, with the words the bot gave it, if any. */
  readonly threads: ReadonlyArray<{ readonly link: ThreadLink; readonly label: string }>;
  readonly pullRequests: ReadonlyArray<BotDigestPullRequest>;
  /** The short answers an ask offers after an arrow (`→ Push | Hold`), each sent as the reply. */
  readonly answers: ReadonlyArray<string>;
}

export interface BotDigestSection {
  readonly title: string;
  /** Needs you holds what only the owner can settle: answered, never put away. */
  readonly kind: "needs-you" | "status";
  readonly items: ReadonlyArray<BotDigestItem>;
}

type Segment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "link"; readonly text: string };

const EMPTY_ITEM = /^(nothing|none)( yet)?\.?$/i;
/** The digest's one-line status, wherever the bot put it. */
const STATUS_LINE = /^status:\s*(.+)$/i;
/** An ask's answers: the line's last arrow and the short words after it, at most four. */
const ANSWERS = /\s*→\s*([^→]+)$/u;
const MAX_ANSWERS = 4;
const MAX_ANSWER_LENGTH = 32;
/** Where an ask is finished: sentence punctuation, or a link ending the line. */
const FINISHED_ASK =
  /(?:[?.!]|\]\((?:<[^<>]*>|[^\s()]*)\)|<[a-z][\w+.-]*:\/\/[^\s<>]+>|https?:\/\/\S+)$/iu;
/** A code span, a Markdown link (an angle-bracketed destination may hold parentheses), an
    autolink, or a bare web URL. */
const TOKEN =
  /(`[^`\n]*`)|\[([^\]\n]*)\]\((?:<([^<>\n]+)>|([^\s<>()]+))\)|<([a-z][\w+.-]*:\/\/[^\s<>]+)>|(https?:\/\/[^\s<>()[\]]+)/gi;
/** What may sit between the links that end a line. */
const BETWEEN_LINKS = /^[\s()[\],;.]*$/;
/** A line whose words end a sentence before its last links appends them; any other last link
    belongs to the sentence. */
const SENTENCE_END = /[?.!:–—-][\s()[\]]*$/;

const unmarked = (line: string) =>
  line
    .replace(/^(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .trim();

const plain = (segments: ReadonlyArray<Segment>) =>
  segments
    .map((segment) => segment.text)
    .join("")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();

/** The line without its answers, and the answers, when the arrow follows a finished ask (a
    question or sentence, or a link: a Markdown link, an autolink or a bare URL) and what follows
    reads as short answers; anything else, like "Migrate (staging) → prod", stays the line's. */
function splitAnswers(line: string): { readonly line: string; readonly answers: string[] } {
  const match = ANSWERS.exec(line);
  const answers =
    match?.[1]
      ?.split("|")
      .map((answer) => answer.trim())
      .filter(Boolean) ?? [];
  if (
    match === null ||
    !FINISHED_ASK.test(line.slice(0, match.index).trimEnd()) ||
    answers.length === 0 ||
    answers.length > MAX_ANSWERS ||
    answers.some((answer) => answer.length > MAX_ANSWER_LENGTH)
  ) {
    return { line, answers: [] };
  }
  return { line: line.slice(0, match.index), answers };
}

/** One line as plain words, and the threads and pull requests it links. A link reads as its
    label, a bare pull request URL as its number. Only an ask (`withAnswers`) reads answers. */
function parseItem(line: string, withAnswers = false): BotDigestItem {
  const split = withAnswers ? splitAnswers(unmarked(line)) : { line: unmarked(line), answers: [] };
  const source = split.line.trim();
  const threads: Array<{ link: ThreadLink; label: string }> = [];
  const pullRequests: BotDigestPullRequest[] = [];
  const segments: Segment[] = [];
  let at = 0;
  for (const match of source.matchAll(TOKEN)) {
    const [written, code, label, angledHref, labeledHref, autolink, bare] = match;
    segments.push({ kind: "text", text: source.slice(at, match.index) });
    at = match.index + written.length;
    const href = angledHref ?? labeledHref ?? autolink;
    // A sentence's closing punctuation is not part of a bare URL.
    const url = href ?? bare?.replace(/[.,;:!?]+$/, "") ?? "";
    const tail = href === undefined && bare !== undefined ? bare.slice(url.length) : "";
    const thread = code === undefined ? parseThreadLinkHref(url) : null;
    const pullRequest =
      code === undefined && thread === null
        ? (sourceControlClients.parseChangeRequestUrl(url)?.link ?? null)
        : null;
    if (thread !== null) {
      const seen = threads.find(
        (t) => t.link.threadId === thread.threadId && t.link.environmentId === thread.environmentId,
      );
      if (seen === undefined) threads.push({ link: thread, label: label?.trim() ?? "" });
      else if (seen.label === "") seen.label = label?.trim() ?? "";
      segments.push({ kind: "link", text: label ?? "" });
    } else if (pullRequest !== null) {
      if (!pullRequests.some((other) => other.url === url)) {
        pullRequests.push({ url, number: pullRequest.number });
      }
      segments.push({ kind: "link", text: label ?? `#${pullRequest.number}` });
    } else {
      segments.push({
        kind: "text",
        text: label ?? written.slice(0, written.length - tail.length),
      });
    }
    if (tail !== "") segments.push({ kind: "text", text: tail });
  }
  segments.push({ kind: "text", text: source.slice(at) });
  // The run of links that ends the line, and what separates them, back to the sentence end.
  let end = segments.length;
  let sawLink = false;
  for (let segment = segments[end - 1]; segment !== undefined; segment = segments[end - 1]) {
    // Past a link, a sentence end (in the text, or ending a link's label) is where it stops.
    if (sawLink && /[.?!:]\s*$/.test(segment.kind === "link" ? segment.text : "")) break;
    if (segment.kind === "text") {
      if (!BETWEEN_LINKS.test(segment.text)) break;
      if (sawLink && /[.?!:]/.test(segment.text)) break;
    } else {
      sawLink = true;
    }
    end -= 1;
  }
  // An opening bracket the links sat in is theirs, not the sentence's.
  const words = plain(segments.slice(0, end)).replace(/[\s([]+$/, "");
  const appended =
    segments.slice(end).some((segment) => segment.kind === "link") && SENTENCE_END.test(words);
  return {
    text: appended ? words : plain(segments),
    source,
    threads,
    pullRequests,
    answers: split.answers,
  };
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
    // Skips the title and the status line under it; a "#" with no space after it starts an item.
    if (current === null || line === "" || /^#\s/.test(line)) continue;
    const item = parseItem(line, /^needs you$/i.test(current.title));
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
  return sections
    .filter((section) => section.items.length > 0)
    .map((section) => ({
      ...section,
      kind: /^needs you$/i.test(section.title) ? ("needs-you" as const) : ("status" as const),
    }));
}

/** The digest's status line in plain words (`Status: Waiting on you · next scan Thu 8:00`), read
    under the title only, or null when the bot wrote none. */
export function parseBotDigestStatus(contents: string): string | null {
  for (const raw of contents.split(/\r?\n/)) {
    if (/^#{2,6}\s/.test(raw.trim())) return null;
    const status = STATUS_LINE.exec(raw.trim())?.[1];
    if (status === undefined) continue;
    const text = parseItem(status).text;
    return text === "" || EMPTY_ITEM.test(text) ? null : text;
  }
  return null;
}

/** An ask's question, to lead its card, and the rest of its line as quieter detail. The question
    is its first sentence that asks one; a line that asks none leads with its first sentence. */
export function splitBotDigestAsk(text: string): {
  readonly question: string;
  readonly detail: string | null;
} {
  const sentences = text.match(/\S[\s\S]*?(?:[?.!](?=\s|$)|$)/gu) ?? [];
  const asking = sentences.findIndex((sentence) => sentence.endsWith("?"));
  const at = asking === -1 ? 0 : asking;
  if (sentences[at] === undefined) return { question: text, detail: null };
  const detail = sentences
    .filter((_, index) => index !== at)
    .join(" ")
    .trim();
  return { question: sentences[at]!, detail: detail === "" ? null : detail };
}
