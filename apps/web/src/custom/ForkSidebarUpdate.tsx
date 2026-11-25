/* oxlint-disable t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog) */
import type { DesktopUpdateState } from "@t3tools/contracts";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

const RING_RADIUS = 6;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Sits beside the sidebar's "Update" pill while the app update downloads. It shrinks
 * and clips first when the footer is too narrow, so the pill never leaves the sidebar.
 */
export function ForkUpdateDownloadRing({ percent }: { readonly percent: number | null }) {
  const clamped =
    percent === null || !Number.isFinite(percent) ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <span
      className="flex min-w-0 shrink justify-end overflow-hidden"
      data-fork-update-download-ring=""
    >
      <svg
        aria-hidden="true"
        className="mr-2 size-4 shrink-0 -rotate-90 text-sidebar-foreground"
        viewBox="0 0 16 16"
      >
        <circle
          cx="8"
          cy="8"
          r={RING_RADIUS}
          fill="none"
          className="stroke-current/20"
          strokeWidth="2"
        />
        <circle
          cx="8"
          cy="8"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - clamped / 100)}
          strokeLinecap="round"
          strokeWidth="2"
          className="transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
        />
      </svg>
    </span>
  );
}

type PendingRestart = {
  readonly version: string | null;
  readonly resolve: (confirmed: boolean) => void;
};

/**
 * Replaces the generic confirm before installing a downloaded app update.
 * Returns an async confirm with the same contract, and the dialog to render.
 */
export function useForkUpdateRestartConfirm() {
  const [pending, setPending] = useState<PendingRestart | null>(null);

  const confirm = (state: Pick<DesktopUpdateState, "availableVersion" | "downloadedVersion">) =>
    new Promise<boolean>((resolve) => {
      setPending({ version: state.downloadedVersion ?? state.availableVersion, resolve });
    });

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const dialog = (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(next) => {
        if (!next) settle(false);
      }}
    >
      {/* Refocusing the trigger after a pointer close shows its focus ring and opens its tooltip. */}
      <AlertDialogPopup
        className="sm:max-w-sm"
        finalFocus={(closeType) => closeType === "keyboard"}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Restart to update</AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.version ? (
              <>
                Version <span className="font-mono text-xs">{pending.version}</span> is ready.{" "}
              </>
            ) : (
              "The update is ready. "
            )}
            Anything running stops when the app restarts.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter variant="bare">
          <AlertDialogClose render={<Button variant="ghost" />}>Not now</AlertDialogClose>
          <AlertDialogAction onClick={() => settle(true)}>Restart</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );

  return [confirm, dialog] as const;
}
