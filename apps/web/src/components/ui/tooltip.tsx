import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type RefObject,
} from "react";

import { cn } from "~/lib/utils";
import { useNativeTitlebarHeight } from "~/lib/windowControlsOverlay";

// Base UI's default, restated because a padding object zeroes the sides it omits.
const COLLISION_PADDING = 5;

const TooltipProvider = TooltipPrimitive.Provider;

type TooltipActionsRef = RefObject<TooltipPrimitive.Root.Actions | null>;

// The compiler freezes context values; update hovered tooltips through calls instead of shared ref writes.
function createTooltipHoverTracker() {
  let hovered: { trigger: HTMLElement; actionsRef: TooltipActionsRef } | null = null;
  return {
    hover(trigger: HTMLElement, actionsRef: TooltipActionsRef) {
      hovered = { trigger, actionsRef };
    },
    release(actionsRef: TooltipActionsRef) {
      if (hovered?.actionsRef === actionsRef) hovered = null;
    },
    dismissUnfocused() {
      const tooltip = hovered;
      if (!tooltip || tooltip.trigger.contains(tooltip.trigger.ownerDocument.activeElement)) {
        return;
      }
      hovered = null;
      // Base UI also cancels delayed hover opens through this action.
      tooltip.actionsRef.current?.close();
    },
  };
}

type TooltipHoverTracker = ReturnType<typeof createTooltipHoverTracker>;
const TooltipHoverContext = createContext<TooltipActionsRef | null>(null);
const TooltipScrollContext = createContext<TooltipHoverTracker | null>(null);

function TooltipScrollDismissArea({ onScrollCapture, ...props }: ComponentProps<"div">) {
  const [tracker] = useState(createTooltipHoverTracker);
  return (
    <TooltipScrollContext value={tracker}>
      <div
        {...props}
        onScrollCapture={(event) => {
          onScrollCapture?.(event);
          tracker.dismissUnfocused();
        }}
      />
    </TooltipScrollContext>
  );
}

/* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
type ForkTooltipFill = { background: string; foreground: string };
const ForkTooltipFillContext = createContext<ForkTooltipFill | null>(null);

// The tooltip is portaled to the body, so it takes the fill its trigger's surface declares.
function readForkTooltipFill(trigger: Element | undefined): ForkTooltipFill | null {
  if (!trigger || !isInletActive()) return null;
  const style = getComputedStyle(trigger);
  const background = style.getPropertyValue("--fork-inlet-tooltip").trim();
  const foreground = style.getPropertyValue("--fork-inlet-tooltip-foreground").trim();
  return background && foreground ? { background, foreground } : null;
}
/* fork:end fork-inlet-theme */

function Tooltip<Payload>(props: TooltipPrimitive.Root.Props<Payload>) {
  const tracker = use(TooltipScrollContext);
  const localActionsRef = useRef<TooltipPrimitive.Root.Actions | null>(null);
  const actionsRef = props.actionsRef ?? localActionsRef;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- releases this tooltip from the scroll tracker on unmount
  useEffect(() => () => tracker?.release(actionsRef), [actionsRef, tracker]);
  /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
  const [forkFill, setForkFill] = useState<ForkTooltipFill | null>(null);
  const onOpenChange: TooltipPrimitive.Root.Props<Payload>["onOpenChange"] = (open, details) => {
    if (open) setForkFill(readForkTooltipFill(details.trigger));
    props.onOpenChange?.(open, details);
  };
  /* fork:end fork-inlet-theme */

  if (!tracker)
    return (
      <ForkTooltipFillContext value={forkFill}>
        <TooltipPrimitive.Root {...props} onOpenChange={onOpenChange} />
      </ForkTooltipFillContext>
    );
  return (
    <ForkTooltipFillContext value={forkFill}>
      <TooltipHoverContext value={actionsRef}>
        <TooltipPrimitive.Root
          {...props}
          actionsRef={actionsRef}
          onOpenChange={(open, details) => {
            onOpenChange(open, details);
            if (!open && !details.isCanceled) tracker.release(actionsRef);
          }}
        />
      </TooltipHoverContext>
    </ForkTooltipFillContext>
  );
}

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  const tracker = use(TooltipScrollContext);
  const actionsRef = use(TooltipHoverContext);
  if (!tracker || !actionsRef) {
    return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
  }
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      onMouseEnter={(event) => {
        props.onMouseEnter?.(event);
        tracker.hover(event.currentTarget, actionsRef);
      }}
    />
  );
}

function TooltipPositioner(props: TooltipPrimitive.Positioner.Props) {
  const titlebarHeight = useNativeTitlebarHeight();
  /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
  const forkFill = use(ForkTooltipFillContext);
  /* fork:end fork-inlet-theme */
  return (
    <TooltipPrimitive.Positioner
      /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
      style={
        forkFill
          ? ({
              "--fork-inlet-tooltip": forkFill.background,
              "--fork-inlet-tooltip-foreground": forkFill.foreground,
            } as CSSProperties)
          : undefined
      }
      /* fork:end fork-inlet-theme */
      className="pointer-events-none z-[140] max-w-(--available-width) transition-[top,left,right,bottom,transform] data-instant:transition-none"
      collisionPadding={{
        top: COLLISION_PADDING + titlebarHeight,
        right: COLLISION_PADDING,
        bottom: COLLISION_PADDING,
        left: COLLISION_PADDING,
      }}
      data-slot="tooltip-positioner"
      {...props}
    />
  );
}

/* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
import { isInletActive } from "~/custom/forkActivePalette";

/** theme.custom.inlet-menus.css's --fork-inlet-nub-depth. */
const FORK_TOOLTIP_NUB_DEPTH = 7;
/* fork:end fork-inlet-theme */

function TooltipPopup({
  className,
  align = "center",
  sideOffset = 4,
  side = "top",
  variant = "default",
  anchor,
  children,
  /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
  forkNub = true,
  forkNubGap = 0,
  /* fork:end fork-inlet-theme */
  ...props
}: TooltipPrimitive.Popup.Props & {
  align?: TooltipPrimitive.Positioner.Props["align"];
  side?: TooltipPrimitive.Positioner.Props["side"];
  sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
  variant?: "default" | "glass" | "code";
  anchor?: TooltipPrimitive.Positioner.Props["anchor"];
  /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
  /** Inlet's nub and its standoff; a card that hangs as a tab (the row hover card) opts out. */
  forkNub?: boolean;
  /** Inlet: px between the nub's tip and the trigger. Upstream callers' sideOffset is
      their nub-less standoff, so it stays ignored under Inlet. */
  forkNubGap?: number;
  /* fork:end fork-inlet-theme */
}) {
  /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
  // Inlet stands off by the nub's depth so its tip meets the trigger; read per positioning.
  const positionerSideOffset: TooltipPrimitive.Positioner.Props["sideOffset"] = forkNub
    ? (data) =>
        isInletActive()
          ? FORK_TOOLTIP_NUB_DEPTH + forkNubGap
          : typeof sideOffset === "function"
            ? sideOffset(data)
            : sideOffset
    : sideOffset;
  /* fork:end fork-inlet-theme */
  return (
    <TooltipPrimitive.Portal>
      <TooltipPositioner
        align={align}
        anchor={anchor}
        side={side}
        sideOffset={
          /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
          positionerSideOffset
          /* fork:end fork-inlet-theme */
        }
      >
        <TooltipPrimitive.Popup
          className={cn(
            "relative flex origin-(--transform-origin) text-balance rounded-md text-popover-foreground text-xs transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-md)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 data-instant:duration-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            variant === "glass"
              ? "dropdown-glass shadow-xl shadow-black/25 before:hidden"
              : "border bg-popover not-dark:bg-clip-padding shadow-md/5",
            variant === "code"
              ? "max-w-120 wrap-anywhere text-left font-mono text-[11px] leading-relaxed"
              : "max-w-80 wrap-anywhere whitespace-normal leading-snug",
            className,
          )}
          data-slot="tooltip-popup"
          {...props}
        >
          <div className="min-w-0 px-2 py-1" data-slot="tooltip-viewport">
            {children}
          </div>
          {/* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme
              Hidden here; Inlet draws it as the nub that points at the trigger. */}
          <TooltipPrimitive.Arrow data-fork-tooltip-nub="" className="hidden" />
          {/* fork:end fork-inlet-theme */}
        </TooltipPrimitive.Popup>
      </TooltipPositioner>
    </TooltipPrimitive.Portal>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipPopup, TooltipScrollDismissArea };
