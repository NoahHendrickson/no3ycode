/**
 * The room the stage's rightmost column header leaves for the window's panel controls, which are
 * pinned to the window's top right — see `.fork/customizations.yaml#fork-bot-work-threads`. One
 * definition for the right panel's tab bar and a bot's Threads panel, whichever is rightmost.
 */
import { isElectron } from "~/env";

/** The header's right padding under the controls. */
export const TITLEBAR_CONTROLS_INSET_CLASS = "pr-28";

/** In the desktop app: the caption-button spacer on Windows, and a no-drag rect over the
    controls so the header's drag region (later in the document) cannot swallow their clicks. */
export function TitlebarControlsReserve(props: { readonly spacer: boolean }) {
  if (!isElectron) return null;
  return (
    <>
      {props.spacer ? <span aria-hidden className="hidden w-24 shrink-0 wco:block" /> : null}
      <span
        aria-hidden
        className="pointer-events-none fixed top-[var(--workspace-controls-top)] right-[var(--workspace-controls-right)] h-[var(--workspace-topbar-height)] w-28 [-webkit-app-region:no-drag]"
      />
    </>
  );
}
