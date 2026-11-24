/**
 * The no3y queued-messages banner's rules — see `.fork/customizations.yaml#fork-queued-runs-banner`.
 * Ported from the Mac fork's apps/web/src/custom/ForkQueuedRunsBanner.tsx, not imported.
 */
import { resolveUserMessagePresentation } from "@t3tools/client-runtime/user-message";

const SENDER_LABEL = { agent: "Agent", automation: "Automation", t3code: "T3 Code" } as const;

/** Who queued it, when it was not the owner typing: the guest's name, or the agent or automation. */
export function no3yQueuedSender(
  message: Parameters<typeof resolveUserMessagePresentation>[0] | undefined,
): { readonly label: string; readonly guest: boolean } | null {
  if (!message) return null;
  const presentation = resolveUserMessagePresentation(message);
  if (presentation.attribution === "guest" && presentation.guestName !== undefined) {
    return { label: presentation.guestName, guest: true };
  }
  if (presentation.attribution === null || presentation.attribution === "guest") return null;
  return { label: SENDER_LABEL[presentation.attribution], guest: false };
}

/** The queued-run.reorder input that moves a row one place, or null at either end. */
export function no3yQueueMove<RunId extends string>(
  runIds: ReadonlyArray<RunId>,
  runId: RunId,
  direction: "up" | "down",
): { readonly runId: RunId; readonly beforeRunId: RunId | null } | null {
  const index = runIds.indexOf(runId);
  if (index < 0) return null;
  if (direction === "up") {
    return index === 0 ? null : { runId, beforeRunId: runIds[index - 1]! };
  }
  return index === runIds.length - 1 ? null : { runId, beforeRunId: runIds[index + 2] ?? null };
}
