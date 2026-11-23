/**
 * The device-local prompt stash on iOS — see `.fork/customizations.yaml#no3y-prompt-stash`. Like the
 * Mac's promptStashStore: newest first, at most 20, kept on this device only. Text only: mobile
 * drafts keep attachments in their own store, so a stashed prompt leaves them in the composer.
 */
export const MAX_STASHED_PROMPTS = 20;

export interface StashedPrompt {
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
  readonly projectTitle: string | null;
}

export function addStashedPrompt(
  entries: ReadonlyArray<StashedPrompt>,
  entry: StashedPrompt,
): ReadonlyArray<StashedPrompt> {
  if (entry.text.trim().length === 0) return entries;
  return [entry, ...entries.filter((existing) => existing.id !== entry.id)].slice(
    0,
    MAX_STASHED_PROMPTS,
  );
}

export function removeStashedPrompt(
  entries: ReadonlyArray<StashedPrompt>,
  id: string,
): ReadonlyArray<StashedPrompt> {
  return entries.filter((entry) => entry.id !== id);
}

/** What restoring puts in the composer: the prompt alone, or after what is already typed. */
export function restoredDraftText(current: string, stashed: string, mode: "replace" | "append") {
  if (mode === "replace" || current.trim().length === 0) return stashed;
  return `${current.trimEnd()}\n\n${stashed}`;
}

export function stashedPromptTitle(text: string): string {
  return text.trim().split("\n")[0]!.trim();
}

function isStashedPrompt(value: unknown): value is StashedPrompt {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry["id"] === "string" &&
    typeof entry["text"] === "string" &&
    typeof entry["createdAt"] === "string" &&
    (entry["projectTitle"] === null || typeof entry["projectTitle"] === "string")
  );
}

/** Reads what was saved, dropping anything malformed rather than losing the whole stash. */
export function decodeStashedPrompts(raw: string | null): ReadonlyArray<StashedPrompt> {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isStashedPrompt).slice(0, MAX_STASHED_PROMPTS)
      : [];
  } catch {
    return [];
  }
}

export interface PromptStashBackend {
  readonly read: () => string | null;
  readonly write: (raw: string) => void;
}

/** A small external store the composer menu, the sheet and the queue banner share. */
export function createPromptStash(backend: PromptStashBackend) {
  let entries: ReadonlyArray<StashedPrompt> | null = null;
  const listeners = new Set<() => void>();
  const load = () => (entries ??= decodeStashedPrompts(backend.read()));
  const commit = (next: ReadonlyArray<StashedPrompt>) => {
    entries = next;
    backend.write(JSON.stringify(next));
    for (const listener of listeners) listener();
  };
  return {
    entries: load,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    add(entry: StashedPrompt) {
      commit(addStashedPrompt(load(), entry));
    },
    remove(id: string) {
      commit(removeStashedPrompt(load(), id));
    },
  };
}
