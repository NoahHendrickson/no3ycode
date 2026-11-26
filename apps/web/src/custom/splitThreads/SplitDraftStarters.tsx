/** What an empty split draft offers in place of "Send a message to start the conversation"
 * (fork-split-threads): a card of starters for working beside the other agent on the same
 * branch. A row hands its prompt to ChatView, which adds it to the composer and focuses it. */
import { msg, useMessages } from "gt-react";

import { DEV_SERVER_SUGGESTION } from "../draftLaunchpadSuggestions";
import { EyeIcon, PlayIcon } from "../icons/lucide-hugeicons";

const STARTERS = [
  {
    key: "review",
    title: msg("Review this branch"),
    Icon: EyeIcon,
    prompt:
      "Review the changes on this branch, including uncommitted work. Look for bugs, regressions and anything that doesn't fit the rest of the code. List what you find, most important first, and don't change any files.",
  },
  {
    key: "dev-server",
    // The launchpad's title, marked for translation here.
    title: msg("Start the dev server"),
    Icon: PlayIcon,
    prompt: DEV_SERVER_SUGGESTION.prompt,
  },
] as const;

export function SplitDraftStarters(props: {
  /** Keeps the card centred in the space above the composer. */
  readonly bottomInset: number;
  readonly onPick: (prompt: string) => void;
}) {
  const m = useMessages();
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center px-4"
      style={{ paddingBottom: props.bottomInset }}
    >
      <div
        data-fork-split-draft-starters=""
        className="pointer-events-auto flex w-full max-w-sm flex-col divide-y divide-border overflow-hidden rounded-(--fork-composer-radius) border border-border bg-card"
      >
        {STARTERS.map(({ key, title, Icon, prompt }) => (
          <button
            key={key}
            type="button"
            className="flex h-11 w-full min-w-0 cursor-pointer select-none items-center gap-2.5 px-3.5 text-left text-foreground text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
            onClick={() => props.onPick(prompt)}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{m(title)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
