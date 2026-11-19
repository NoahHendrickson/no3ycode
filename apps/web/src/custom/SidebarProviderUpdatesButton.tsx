import { PROVIDER_DISPLAY_NAMES } from "@t3tools/contracts";
import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import { PackageIcon } from "lucide-react";
import { useRef, useState } from "react";

import { getProviderUpdateRunToastView } from "~/components/ProviderUpdateLaunchNotification.logic";
import { useProviderUpdates } from "~/components/ProviderUpdatesAction";
import { Button } from "~/components/ui/button";
import { SidebarMenuItem } from "~/components/ui/sidebar";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { usePrimaryEnvironmentId } from "~/state/environments";

/** Provider CLI updates, apart from the app's Update pill. Once started, progress and results
 * belong to the footer's provider pill, so the button steps aside until the run settles. */
export function SidebarProviderUpdatesButton() {
  const { machines, updateAll } = useProviderUpdates();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const pending = useRef(false);
  const [isPending, setIsPending] = useState(false);
  if (machines.length === 0 || isPending) return null;

  const handleUpdate = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsPending(true);
    // The footer pill only reports the primary environment; other machines still get a toast.
    const quiet = machines.every((machine) => machine.environmentId === primaryEnvironmentId);
    const result = await settlePromise(() => updateAll({ quiet }));
    // A rejected request never writes updateState, so the footer pill cannot show it.
    const rejected =
      quiet && result._tag === "Success"
        ? result.value.filter((run) => run.result._tag === "Failure")
        : [];
    const view = getProviderUpdateRunToastView(rejected);
    if (view?.type === "error") {
      toastManager.add(
        stackedThreadToast({
          ...view,
          description: <span className="whitespace-pre-line">{view.description}</span>,
        }),
      );
    }
    pending.current = false;
    setIsPending(false);
  };

  return (
    // Icon-only so it and the app pill both fit the 208px minimum sidebar. It owns the push to
    // the right edge, so the app pill after it sits flush beside it.
    <SidebarMenuItem className="ml-auto shrink-0 [&+li]:ml-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="secondary"
              size="icon-sm-pill"
              type="button"
              aria-label="Update providers"
              onClick={() => void handleUpdate()}
            >
              <PackageIcon className="size-4" />
            </Button>
          }
        />
        <TooltipPopup side="top">
          <div className="font-medium">Update providers</div>
          {machines.map((machine) => (
            <div key={machine.environmentId} className="text-muted-foreground">
              {machines.length > 1 ? `${machine.label}: ` : ""}
              {machine.candidates
                .map((candidate) => PROVIDER_DISPLAY_NAMES[candidate.driver] ?? candidate.driver)
                .join(", ")}
            </div>
          ))}
        </TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
