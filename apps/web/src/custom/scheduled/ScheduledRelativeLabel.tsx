/**
 * Moved out of `components/settings/ScheduledTasksSettings.tsx` so the sidebar's bot cards can
 * render it without bundling the settings page at startup — see
 * `.fork/customizations.yaml#fork-bots`. Keep this module's imports light.
 */
import { msg, useMessages } from "gt-react";

import { useNowMinute } from "~/hooks/useNowMinute";
import { m, type MessageResolver } from "~/i18n/messages";
import { formatRelativeTime } from "~/timestampFormat";

/** formatRelativeTime handles only the past; upcoming runs need future labels. */
function relativeLabel(value: string | null, nowMs: number, resolve: MessageResolver = m): string {
  if (!value) return resolve(msg("Not scheduled"));
  const diffMs = new Date(value).getTime() - nowMs;
  if (diffMs <= 0) {
    const relative = formatRelativeTime(value, nowMs, resolve);
    if (!relative) return resolve(msg("Not scheduled"));
    return relative.label;
  }
  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 2) return resolve(msg("in under a minute"));
  if (minutes < 60) return resolve(msg("in {minutes}m", { minutes }));
  const hours = Math.round(minutes / 60);
  if (hours < 24) return resolve(msg("in {hours}h", { hours }));
  return resolve(msg("in {days}d", { days: Math.round(hours / 24) }));
}

// Use the label's minute tick because the compiler caches render-time Date.now() on the timestamp.
export function ScheduledRelativeLabel(props: { value: string | null }) {
  const messages = useMessages();
  const nowMinute = useNowMinute();
  return relativeLabel(props.value, Date.parse(`${nowMinute}:00.000Z`), messages);
}
