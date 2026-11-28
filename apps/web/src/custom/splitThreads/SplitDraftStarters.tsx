/** What an empty split draft offers in place of "Send a message to start the conversation"
 * (fork-split-threads): a card of starters for working beside the other agent on the same
 * branch. A row hands its prompt to ChatView, which adds it to the composer and focuses it. */
import { msg, useMessages } from "gt-react";

import { DEV_SERVER_SUGGESTION } from "../draftLaunchpadSuggestions";
import { EyeIcon, PlayIcon } from "../icons/lucide-hugeicons";
import { StarterCard } from "../StarterCard";

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
      <div className="pointer-events-auto flex w-full max-w-sm">
        <StarterCard
          starters={STARTERS.map(({ title, ...starter }) => ({ ...starter, label: m(title) }))}
          onPick={props.onPick}
        />
      </div>
    </div>
  );
}
