import type { ModelSelection, ProviderInstanceId, RuntimeMode } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import { T, useGT, useMessages } from "gt-react";
import { type ComponentProps, memo, useId, useRef } from "react";

import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { focusRequestedPermission, useComposerMenuProps } from "./composerEventScope";
import { ComposerPrimaryActions } from "./ComposerPrimaryActions";
import { resolveModelPickerSelectedModel } from "./ModelPickerContent";
import { ProviderModelPicker } from "./ProviderModelPicker";
import { resolveRuntimeModeOption, runtimeModeConfig } from "./runtimeModeConfig";
import { useComposerMenuState } from "./useComposerMenuState";
/* fork:begin fork-composer-shell — see .fork/customizations.yaml#fork-composer-shell */
import { ComposerControlIcon } from "./ComposerControl";
import { ComposerRuntimeModeTrigger } from "../../custom/ComposerShell";
import { ShieldOffFilledIcon } from "../../custom/icons/ShieldOffFilledIcon";
/* fork:end fork-composer-shell */

export type RuntimeModeOption = {
  mode: RuntimeMode;
  disabledReason?: string;
} & (typeof runtimeModeConfig)[RuntimeMode];
export const ComposerFooterModeControls = memo(function ComposerFooterModeControls(props: {
  runtimeMode: RuntimeMode;
  runtimeModeOptions: ReadonlyArray<RuntimeModeOption>;
  size?: "sm" | "xs";
  hidden?: boolean;
  /** How the permissions chip shows: hidden while the thread matches the user's default. */
  accessDisplay?: "label" | "icon" | "hidden";
  /** Draw the icon in the label color, not muted (the mode differs from the user's default). */
  emphasized?: boolean;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const gt = useGT();
  const messages = useMessages();
  const size = props.size ?? "sm";
  const accessDisplay = props.accessDisplay ?? "label";
  const composerFloatingLayerProps = useComposerMenuProps();
  const [open, setOpen] = useComposerMenuState(props.hidden);
  const permissionsChipRef = useRef<HTMLButtonElement>(null);
  const runtimeModeOption =
    props.runtimeModeOptions.find((option) => option.mode === props.runtimeMode) ??
    resolveRuntimeModeOption("approval-required", messages);
  const RuntimeModeIcon = runtimeModeOption.icon;
  /* fork:begin fork-composer-shell — see .fork/customizations.yaml#fork-composer-shell */
  const ChipIcon = props.runtimeMode === "full-access" ? ShieldOffFilledIcon : RuntimeModeIcon;
  /* fork:end fork-composer-shell */
  // The chip opens the same Permissions toggle used in the model picker and the overflow menu.
  const permissionsTooltip = gt("Permissions: {mode}. {description}", {
    mode: runtimeModeOption.label,
    description: runtimeModeOption.description,
  });
  const permissionsChip = (
    <Menu
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) =>
        focusRequestedPermission(isOpen, permissionsChipRef.current)
      }
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                /* fork:begin fork-composer-shell — see .fork/customizations.yaml#fork-composer-shell */
                <ComposerRuntimeModeTrigger
                  ref={permissionsChipRef}
                  data-composer-shortcut="composer.mode"
                  size={size}
                  runtimeMode={props.runtimeMode}
                  aria-label={gt("Permissions: {mode}", { mode: runtimeModeOption.label })}
                />
                /* fork:end fork-composer-shell */
              }
            />
          }
        >
          <ComposerControlIcon
            /* fork:begin fork-composer-shell — see .fork/customizations.yaml#fork-composer-shell */
            icon={ChipIcon}
            /* fork:end fork-composer-shell */
            size={size}
            // Match the label, not full foreground: the chip's presence already marks the mode.
            {...(props.emphasized ? { className: "text-current" } : {})}
          />
          <span
            data-composer-control-label
            className={accessDisplay === "icon" ? "sr-only" : undefined}
          >
            {runtimeModeOption.label}
          </span>
        </TooltipTrigger>
        <TooltipPopup side="top">{permissionsTooltip}</TooltipPopup>
      </Tooltip>
      <MenuPopup
        align="start"
        {...composerFloatingLayerProps}
        /* fork:begin fork-composer-shell — see .fork/customizations.yaml#fork-composer-shell
           Glass draws the mode menu's selected row as a pane of glass
           (theme.custom.glass-surfaces.css). */
        data-fork-glass-selection
        /* fork:end fork-composer-shell */
      >
        <ComposerPermissionsSection
          runtimeMode={props.runtimeMode}
          runtimeModeOptions={props.runtimeModeOptions}
          onRuntimeModeChange={props.onRuntimeModeChange}
        />
      </MenuPopup>
    </Menu>
  );

  return accessDisplay === "hidden" ? null : permissionsChip;
});

/**
 * Permission modes as a menu list. Lives inside a Menu: the permissions chip, the model picker,
 * or the overflow menu.
 */
export function ComposerPermissionsSection(props: {
  runtimeMode: RuntimeMode;
  runtimeModeOptions: ReadonlyArray<RuntimeModeOption>;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const gt = useGT();
  const descriptionId = useId();
  /* fork:begin fork-composer-shell — see .fork/customizations.yaml#fork-composer-shell
     A plain menu: each mode's name over its description, the picked one checked on the right.
     Radio items keep menu arrow-key navigation and close the menu on a pick. */
  return (
    <div data-composer-permissions className="grid w-72 gap-0.5 p-1">
      <div
        data-composer-permissions-label
        className="px-2 pb-1 font-medium text-muted-foreground text-sm"
      >
        <T>Permissions</T>
      </div>
      <MenuRadioGroup
        aria-label={gt("Permissions")}
        value={props.runtimeMode}
        onValueChange={(value: RuntimeMode) => {
          if (value !== props.runtimeMode) props.onRuntimeModeChange(value);
        }}
      >
        {props.runtimeModeOptions.map((option) => (
          <MenuRadioItem
            key={option.mode}
            value={option.mode}
            disabled={option.disabledReason !== undefined}
            closeOnClick
            className="my-0.5"
            aria-label={option.label}
            aria-describedby={`${descriptionId}-${option.mode}`}
          >
            <span className="flex w-full items-center gap-3 py-0.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{option.label}</span>
                <span
                  id={`${descriptionId}-${option.mode}`}
                  className="text-muted-foreground text-xs leading-4"
                >
                  {option.disabledReason ?? option.description}
                </span>
              </span>
              <MenuRadioItemIndicator />
            </span>
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </div>
  );
  /* fork:end fork-composer-shell */
}

export const ComposerFooterPrimaryActions = memo(function ComposerFooterPrimaryActions(props: {
  children?: React.ReactNode;
  compact: boolean;
  canOperateThread: boolean;
  isPreparingWorktree: boolean;
  pendingAction: {
    questionIndex: number;
    isLastQuestion: boolean;
    canAdvance: boolean;
    isResponding: boolean;
    isComplete: boolean;
  } | null;
  isRunning: boolean;
  canInterrupt: boolean;
  runId: string | null;
  followUpBehavior: "queue" | "steer";
  canSteer: boolean;
  alternateShortcutLabel: string | null;
  voiceInputActive?: boolean;
  isSendBusy: boolean;
  isSendHeld?: boolean;
  sendDisabledReason: string | null;
  isEnvironmentUnavailable: boolean;
  hasSendableContent: boolean;
  canResume: boolean;
  preserveComposerFocusOnPointerDown?: boolean;
  isEditingQueuedMessage: boolean;
  onSubmitMessage: React.MouseEventHandler<HTMLButtonElement>;
  onResume: () => void;
  /* fork:begin fork-local-dictation — see .fork/customizations.yaml#fork-local-dictation */
  forkDictation?: ComponentProps<typeof ComposerPrimaryActions>["forkDictation"];
  /* fork:end fork-local-dictation */
  onPreviousPendingQuestion: () => void;
  onInterrupt: () => void;
  compactBeforeSendTokens: number | null;
  hideCompactToggle: boolean;
  keepFullHistory: boolean;
  onToggleKeepFullHistory: () => void;
}) {
  return (
    <>
      <ComposerPrimaryActions
        compact={props.compact}
        canOperateThread={props.canOperateThread}
        pendingAction={props.pendingAction}
        isRunning={props.isRunning}
        canInterrupt={props.canInterrupt}
        runId={props.runId}
        followUpBehavior={props.followUpBehavior}
        canSteer={props.canSteer}
        alternateShortcutLabel={props.alternateShortcutLabel}
        voiceInputActive={props.voiceInputActive ?? false}
        isSendBusy={props.isSendBusy}
        isSendHeld={props.isSendHeld ?? false}
        sendDisabledReason={props.sendDisabledReason}
        isEnvironmentUnavailable={props.isEnvironmentUnavailable}
        isPreparingWorktree={props.isPreparingWorktree}
        hasSendableContent={props.hasSendableContent}
        canResume={props.canResume}
        preserveComposerFocusOnPointerDown={props.preserveComposerFocusOnPointerDown ?? false}
        isEditingQueuedMessage={props.isEditingQueuedMessage}
        onSubmitMessage={props.onSubmitMessage}
        onResume={props.onResume}
        /* fork:begin fork-local-dictation — see .fork/customizations.yaml#fork-local-dictation */
        forkDictation={props.forkDictation ?? null}
        /* fork:end fork-local-dictation */
        onPreviousPendingQuestion={props.onPreviousPendingQuestion}
        onInterrupt={props.onInterrupt}
        compactBeforeSendTokens={props.compactBeforeSendTokens}
        hideCompactToggle={props.hideCompactToggle}
        keepFullHistory={props.keepFullHistory}
        onToggleKeepFullHistory={props.onToggleKeepFullHistory}
      >
        {props.children}
      </ComposerPrimaryActions>
    </>
  );
});

/**
 * The composer's model picker. It owns the single- and multi-model selection
 * handlers so they are cached against the selection state, not rebuilt on
 * every ChatComposer render.
 */
export function ComposerModelPicker({
  multipleModelsEnabled,
  multipleModelSelections,
  onMultipleModelSelectionsChange,
  selectedModelSelection,
  onProviderModelSelect,
  ...pickerProps
}: Omit<
  ComponentProps<typeof ProviderModelPicker>,
  "selectedModels" | "onToggleModel" | "onInstanceModelChange"
> & {
  readonly multipleModelsEnabled: boolean;
  readonly multipleModelSelections: ReadonlyArray<ModelSelection> | null;
  readonly onMultipleModelSelectionsChange: (
    selections: ReadonlyArray<ModelSelection> | null,
  ) => void;
  readonly selectedModelSelection: ModelSelection;
  readonly onProviderModelSelect: (
    instanceId: ProviderInstanceId,
    model: string,
    options?: { focusComposer?: boolean },
  ) => void;
}) {
  const { instanceEntries, modelOptionsByInstance } = pickerProps;
  const toggleModel = (instanceId: ProviderInstanceId, model: string) => {
    const current = multipleModelSelections ?? [selectedModelSelection];
    const matchesModel = (selection: ModelSelection) => {
      if (selection.instanceId !== instanceId) return false;
      const entry = instanceEntries.find((entry) => entry.instanceId === selection.instanceId);
      const resolvedModel = resolveModelPickerSelectedModel({
        driverKind: entry?.driverKind,
        model: selection.model,
        options: modelOptionsByInstance?.get(selection.instanceId) ?? [],
      });
      return (resolvedModel?.slug ?? selection.model) === model;
    };
    const exists = current.some(matchesModel);
    const next = exists
      ? current.filter((selection) => !matchesModel(selection))
      : [...current, createModelSelection(instanceId, model)];
    if (next.length > 1) {
      onMultipleModelSelectionsChange(next);
    } else {
      onMultipleModelSelectionsChange(null);
      const remaining = next[0] ?? selectedModelSelection;
      onProviderModelSelect(remaining.instanceId, remaining.model, {
        focusComposer: false,
      });
    }
  };
  return (
    <ProviderModelPicker
      {...pickerProps}
      {...(multipleModelsEnabled
        ? {
            ...(multipleModelSelections !== null
              ? { selectedModels: multipleModelSelections }
              : {}),
            onToggleModel: toggleModel,
          }
        : {})}
      onInstanceModelChange={(instanceId, model) => {
        onMultipleModelSelectionsChange(null);
        onProviderModelSelect(instanceId, model);
      }}
    />
  );
}
