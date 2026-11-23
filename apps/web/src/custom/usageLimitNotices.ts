/**
 * The Usage limits view's warnings — see
 * `.fork/customizations.yaml#fork-usage-limits-surface`. Upstream also warns
 * for a provider that reports no windows at all (e.g. Grok); the fork drops
 * that line, since there is nothing to show or act on. Failures still surface.
 */
import type { LimitPresentations } from "@t3tools/shared/usageLimits";
import { collectLimitNotices, limitsNotice } from "@t3tools/shared/usageLimitsCopy";

import { m, type MessageResolver } from "~/i18n/messages";

export function actionableLimitNotices(
  presentations: LimitPresentations,
  resolve: MessageResolver = m,
): readonly string[] {
  const notices = collectLimitNotices(presentations, resolve);
  // Derived from upstream's helper, so a rewording there cannot bring the line back.
  const noWindowsNotice = limitsNotice({ checkedAt: "", windows: [] }, resolve);
  if (!noWindowsNotice) return notices;
  return notices.filter((notice) => !notice.endsWith(`: ${noWindowsNotice}`));
}
