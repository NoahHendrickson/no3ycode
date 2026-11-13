/**
 * When each bot last said something worth reading — see `.fork/customizations.yaml#fork-bots`.
 * A quiet wake after an unread report must not clear it, and the thread shell only carries the
 * latest message, so the client remembers the last report it saw per bot, per device.
 */
import * as Schema from "effect/Schema";

import { getLocalStorageItem, setLocalStorageItem } from "~/hooks/useLocalStorage";

import { type BotThreadFields, isBotThread, isQuietBotReport } from "./botThreads";

const STORAGE_KEY = "t3code:fork:bot-last-report:v1";
const Reports = Schema.Record(
  Schema.String,
  Schema.Struct({ messageId: Schema.String, seenAt: Schema.Number }),
);
type Reports = typeof Reports.Type;

let reports: Reports | null = null;

function load(): Reports {
  if (reports === null) {
    try {
      reports = getLocalStorageItem(STORAGE_KEY, Reports) ?? {};
    } catch {
      reports = {};
    }
  }
  return reports;
}

interface ReportThread extends BotThreadFields {
  readonly source?:
    | (NonNullable<BotThreadFields["source"]> & {
        readonly latestVisibleMessage?:
          | { readonly id: string; readonly role: string; readonly text: string }
          | null
          | undefined;
      })
    | undefined;
}

/** Records a bot's latest message as a report the first time it is seen, unless it is the quiet reply. */
export function noteBotReport(threadKey: string, thread: ReportThread, now: number): void {
  const latest = thread.source?.latestVisibleMessage;
  if (!isBotThread(thread) || latest == null || latest.role !== "assistant") return;
  if (isQuietBotReport(thread)) return;
  const known = load();
  if (known[threadKey]?.messageId === latest.id) return;
  reports = { ...known, [threadKey]: { messageId: latest.id, seenAt: now } };
  try {
    setLocalStorageItem(STORAGE_KEY, reports, Reports);
  } catch {
    // Storage is full or off: the mark still holds for this session.
  }
}

/** Whether a bot's last report arrived after the thread was last opened. A bot never opened is not unread. */
export function hasUnseenBotReport(threadKey: string, lastVisitedAt: string | undefined): boolean {
  const report = load()[threadKey];
  if (report === undefined || lastVisitedAt === undefined) return false;
  const visitedAt = Date.parse(lastVisitedAt);
  return Number.isNaN(visitedAt) || report.seenAt > visitedAt;
}

/** Test seam: forgets what was loaded so the next read comes from storage. */
export function resetBotReportsForTest(): void {
  reports = null;
}
