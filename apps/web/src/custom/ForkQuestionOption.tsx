/**
 * One answer row of the fork Questions card — see `.fork/customizations.yaml#fork-pending-user-input`.
 * A Petal's digest asks (fork-bot-digest) draw their answers with it too, so both read as one card.
 */
import { CheckIcon } from "./icons/lucide-hugeicons";

import { cn } from "~/lib/utils";
import { textDirection } from "~/textDirection";

function OptionControl({ multiSelect, selected }: { multiSelect: boolean; selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-fork-question-control
      className={cn(
        "flex size-4 shrink-0 items-center justify-center border border-foreground/50",
        multiSelect ? "rounded-sm" : "rounded-full",
        selected && "border-transparent",
      )}
    >
      {selected ? (
        multiSelect ? (
          <CheckIcon className="size-3" strokeWidth={3} />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )
      ) : null}
    </span>
  );
}

export function ForkQuestionOption(props: {
  readonly label: string;
  readonly description?: string | null | undefined;
  readonly multiSelect: boolean;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly keyShortcut?: string | undefined;
  readonly textAlignClassName?: string;
  readonly onSelect: () => void;
}) {
  const { description, selected, disabled } = props;
  return (
    <button
      type="button"
      role={props.multiSelect ? "checkbox" : "radio"}
      aria-checked={selected}
      data-fork-question-option
      aria-keyshortcuts={props.keyShortcut}
      disabled={disabled}
      onClick={props.onSelect}
      className={cn(
        props.textAlignClassName,
        "group flex w-full flex-col gap-1 rounded-xl border p-2 outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/40",
        selected
          ? "border-foreground/24 bg-foreground/8 text-foreground"
          : "border-transparent hover:bg-foreground/4",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && "cursor-pointer",
      )}
    >
      <div className="flex items-center gap-2">
        <OptionControl multiSelect={props.multiSelect} selected={selected} />
        <span className="text-sm text-foreground" dir={textDirection(props.label)}>
          {props.label}
        </span>
      </div>
      {description && description !== props.label ? (
        <div className="flex w-full items-center pl-6">
          <span
            className={cn(
              "flex-1 text-sm font-normal",
              selected ? "text-foreground/80" : "text-muted-foreground",
            )}
            dir={textDirection(description)}
          >
            {description}
          </span>
        </div>
      ) : null}
    </button>
  );
}
