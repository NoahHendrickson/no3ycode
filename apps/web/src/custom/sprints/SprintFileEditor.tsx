/**
 * One of a sprint's files, read and edited in its Threads panel — see
 * `.fork/customizations.yaml#fork-sprints`. The file is read again whenever one of the sprint's
 * runs starts or ends, since the sprint writes these files too. The Goal tab edits one line of
 * PLAN.md through the same hook, with a lens.
 */
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { type ReactNode, useContext, useState } from "react";

import { Button } from "~/components/ui/button";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";

import { useBotDigestConversation } from "../bots/useAnsweredBotDigestAsks";
import { readSprintFile, writeSprintFile } from "./sprintFiles";
import {
  nextSprintFileDraft,
  type SprintFileDraft,
  type SprintFileEditorView,
  sprintFileEditorView,
} from "./sprintFileEditor.logic";

const NO_FILE = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("sprint-file:none"),
);

/** The part of a file an editor shows, and how a save puts it back. */
export interface SprintFileLens {
  readonly read: (file: string) => string;
  /** Applied to a fresh read, so the sprint's own changes to the rest of the file stay. */
  readonly write: (file: string, value: string) => string;
}

/** One of the sprint's files as an editor sees it: on disk, the owner's draft, and saving. */
export function useSprintFile(
  sprintRef: ScopedThreadRef,
  folder: string,
  relativePath: string,
  lens?: SprintFileLens,
) {
  const { environmentId } = sprintRef;
  const registry = useContext(RegistryContext);
  const { canReadFiles } = useFilesystemReadAccess(environmentId);
  const conversation = useBotDigestConversation(scopedThreadKey(sprintRef));
  // Bumped after a save, so the file is read again past the query's cache.
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<SprintFileDraft | null>(null);
  // The text just saved, for the read under this key only.
  const [saved, setSaved] = useState<{ readonly text: string; readonly key: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const query = canReadFiles
    ? projectEnvironment.readFile({
        environmentId,
        input: { cwd: folder, relativePath, allowMissing: true },
      })
    : NO_FILE;
  const readKey = (local: number) => `${conversation?.revision ?? ""}:${local}`;
  const result = useAtomValue(revisionedQuery(query, readKey(revision)));
  const file = AsyncResult.getOrElse(result, () => null);
  const contents = file === null ? null : file.exists === false ? "" : file.contents;
  const disk = contents === null ? null : lens === undefined ? contents : lens.read(contents);
  const view = sprintFileEditorView({
    disk,
    draft,
    saved: saved?.key === readKey(revision) ? saved.text : null,
    reading: result.waiting,
  });
  const target = { environmentId, cwd: folder };

  /** Rewrites the file from a fresh read; false when that failed or came back cut off. */
  const writeFresh = async (change: (current: string) => string): Promise<boolean> => {
    const fresh = await readSprintFile(registry, target, relativePath);
    if (fresh._tag !== "Success" || fresh.value.truncated) return false;
    const current = fresh.value.exists === false ? "" : fresh.value.contents;
    return writeSprintFile(registry, target, relativePath, change(current), { announce: true });
  };

  return {
    canReadFiles,
    /** An image or PDF: the server reads text only. */
    unreadable: AsyncResult.isFailure(result),
    /** The whole file, null until it is read. */
    contents,
    /** A cut-off read, which a whole-file save would write over the whole file. */
    truncated: file?.truncated === true,
    disk,
    view,
    saving,
    edit: (text: string) => setDraft(nextSprintFileDraft(draft, view.value, text)),
    discard: () => setDraft(null),
    /** Saves `value` (through the lens, from a fresh read); false when it failed. `announce`
        tells the sprint on its next message; a lensed save always does. */
    save: async (value: string, announce: boolean): Promise<boolean> => {
      setSaving(true);
      const written =
        lens === undefined
          ? await writeSprintFile(registry, target, relativePath, value, { announce })
          : await writeFresh((current) => lens.write(current, value));
      setSaving(false);
      if (!written) return false;
      setSaved({ text: value, key: readKey(revision + 1) });
      setDraft(null);
      setRevision((current) => current + 1);
      return true;
    },
    /** Another change to the file, from a fresh read, outside the editor. */
    rewrite: async (change: (current: string) => string): Promise<boolean> => {
      const written = await writeFresh(change);
      if (written) setRevision((current) => current + 1);
      return written;
    },
  };
}

/** What the editor's draft stands as, and Discard or Reload, and Save. */
export function SprintFileFooter(props: {
  readonly view: SprintFileEditorView;
  readonly saving: boolean;
  readonly readOnly?: boolean;
  /** Said when the sprint rewrote what the owner is editing. */
  readonly staleNote: string;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly saveTestId: string;
}) {
  const { view } = props;
  const readOnly = props.readOnly === true;
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border px-3.5 py-2">
      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {readOnly
          ? "Too long to edit here."
          : view.stale
            ? props.staleNote
            : view.dirty
              ? "Unsaved changes"
              : ""}
      </p>
      {view.dirty ? (
        <Button type="button" variant="ghost" size="xs" onClick={props.onDiscard}>
          {view.stale ? "Reload" : "Discard"}
        </Button>
      ) : null}
      <Button
        type="button"
        size="xs"
        disabled={!view.dirty || props.saving || readOnly}
        onClick={props.onSave}
        data-testid={props.saveTestId}
      >
        Save
      </Button>
    </div>
  );
}

export function NoSprintFileAccess() {
  return (
    <p className="px-3.5 py-3 text-sm text-muted-foreground">
      This machine does not let you read files.
    </p>
  );
}

export function SprintFileEditor(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly folder: string;
  readonly relativePath: string;
  /** Shown above the text: what the file is for. */
  readonly description: ReactNode;
  readonly placeholder?: string | undefined;
  /** Tell the sprint on its next message that the owner changed this file. */
  readonly announceEdits: boolean;
}) {
  const file = useSprintFile(props.sprintRef, props.folder, props.relativePath);
  const { view, truncated: readOnly } = file;

  const save = async () => {
    if (!view.dirty || file.saving || readOnly) return;
    if (await file.save(view.value, props.announceEdits)) return;
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title: `Could not save ${props.relativePath}`,
        description: "Your changes are still here. Try again.",
      }),
    );
  };

  if (!file.canReadFiles) return <NoSprintFileAccess />;
  if (file.unreadable) {
    return (
      <p className="px-3.5 py-3 text-sm text-muted-foreground" data-fork-sprint-file-unreadable="">
        This file is not text, so it cannot be shown here. The sprint and its threads read it by its
        path.
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-fork-sprint-file={props.relativePath}>
      <p className="shrink-0 px-3.5 pt-2.5 text-xs text-muted-foreground">{props.description}</p>
      <textarea
        aria-label={props.relativePath}
        className="min-h-0 flex-1 resize-none bg-transparent px-3.5 py-2.5 font-mono text-xs/5 text-foreground outline-none placeholder:text-muted-foreground"
        value={view.value}
        placeholder={file.disk === null ? "" : props.placeholder}
        readOnly={readOnly || file.disk === null}
        spellCheck={false}
        onChange={(event) => file.edit(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "s") {
            event.preventDefault();
            void save();
          }
        }}
        data-testid="sprint-file-editor"
      />
      <SprintFileFooter
        view={view}
        saving={file.saving}
        readOnly={readOnly}
        staleNote="The sprint changed this file since you began. Saving replaces its change."
        onSave={() => void save()}
        onDiscard={file.discard}
        saveTestId="sprint-file-save"
      />
    </div>
  );
}
