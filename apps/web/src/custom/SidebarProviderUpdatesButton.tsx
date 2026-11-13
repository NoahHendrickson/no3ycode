import { PROVIDER_DISPLAY_NAMES } from "@t3tools/contracts";
import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import { PackageIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useProviderUpdates } from "~/components/ProviderUpdatesAction";
import { SidebarMenuItem } from "~/components/ui/sidebar";
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
    await settlePromise(() => updateAll({ quiet }));
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
            <button
              type="button"
              aria-label="Update providers"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-sidebar-control-surface text-sidebar-foreground outline-hidden ring-ring transition-colors hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset"
              onClick={() => void handleUpdate()}
            >
              <PackageIcon className="size-4" />
            </button>
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
