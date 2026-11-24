/**
 * Copies a branch's link, or its name where it has none — see
 * `.fork/customizations.yaml#fork-branch-link-copy`.
 */
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { namedClipboardTarget, writeTextToClipboard } from "~/hooks/useCopyToClipboard";

function copyWithToast(value: string, target: string, title: string, description: string): void {
  void writeTextToClipboard(value, namedClipboardTarget(target)).then(
    (didCopy) => {
      if (didCopy) toastManager.add({ type: "success", title, description });
    },
    (error: unknown) => {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: `Failed to copy ${target}`,
          description: error instanceof Error ? error.message : "An error occurred.",
        }),
      );
    },
  );
}

export function copyBranchLink(url: string): void {
  copyWithToast(url, "branch link", "Branch link copied", url);
}

/** The chip's click: the link when the host has a page for it, else the name. */
export function copyBranchReference(input: {
  readonly branch: string;
  readonly url: string | null;
}): void {
  if (input.url === null) {
    copyWithToast(input.branch, "branch name", "Branch name copied", input.branch);
  } else {
    copyBranchLink(input.url);
  }
}
