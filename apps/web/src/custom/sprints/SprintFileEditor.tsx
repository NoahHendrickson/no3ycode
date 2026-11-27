/**
 * One of a sprint's files, read and edited in its Threads panel — see
 * `.fork/customizations.yaml#fork-sprints`. The file is read again whenever one of the sprint's
 * runs starts or ends, since the sprint writes these files too.
 */
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type { ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { type ReactNode, useContext, useState } from "react";

import { Button } from "~/components/ui/button";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";

import { useBotDigestConversation } from "../bots/useAnsweredBotDigestAsks";
import {
  nextSprintFileDraft,
  type SprintFileDraft,
  sprintFileEditorView,
} from "./sprintFileEditor.logic";
import { SPRINT_OWNER_EDITS_DIRECTORY } from "./sprintThreads";

const NO_FILE = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("sprint-file:none"),
);

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
  const { environmentId } = props.sprintRef;
  const registry = useContext(RegistryContext);
  const { canReadFiles } = useFilesystemReadAccess(environmentId);
  const conversation = useBotDigestConversation(scopedThreadKey(props.sprintRef));
  // Bumped after a save, so the file is read again past the query's cache.
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<SprintFileDraft | null>(null);
  // The text just saved, for the read under this key only.
  const [saved, setSaved] = useState<{ readonly text: string; readonly key: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const query = canReadFiles
    ? projectEnvironment.readFile({
        environmentId,
        input: { cwd: props.folder, relativePath: props.relativePath, allowMissing: true },
      })
    : NO_FILE;
  const readKey = (local: number) => `${conversation?.revision ?? ""}:${local}`;
  const result = useAtomValue(revisionedQuery(query, readKey(revision)));
  const file = AsyncResult.getOrElse(result, () => null);
  const disk = file === null ? null : file.exists === false ? "" : file.contents;
  // A cut-off read would save the cut-off text over the whole file.
  const readOnly = file?.truncated === true;
  const view = sprintFileEditorView({
    disk,
    draft,
    saved: saved?.key === readKey(revision) ? saved.text : null,
    reading: result.waiting,
  });

  const write = (relativePath: string, contents: string) =>
    runAtomCommand(
      registry,
      projectEnvironment.writeFile,
      { environmentId, input: { cwd: props.folder, relativePath, contents } },
      { label: projectEnvironment.writeFile.label, reportFailure: false, reportDefect: true },
    );

  const save = async () => {
    if (!view.dirty || saving || readOnly) return;
    const text = view.value;
    setSaving(true);
    const written = await write(props.relativePath, text);
    if (written._tag === "Success" && props.announceEdits) {
      await write(
        `${SPRINT_OWNER_EDITS_DIRECTORY}/${props.relativePath.replaceAll("/", "__")}`,
        `${new Date().toISOString()}\n`,
      );
    }
    setSaving(false);
    if (written._tag !== "Success") {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: `Could not save ${props.relativePath}`,
          description: "Your changes are still here. Try again.",
        }),
      );
      return;
    }
    setSaved({ text, key: readKey(revision + 1) });
    setDraft(null);
    setRevision((current) => current + 1);
  };

  if (!canReadFiles) {
    return (
      <p className="px-3.5 py-3 text-sm text-muted-foreground">
        This machine does not let you read files.
      </p>
    );
  }
  // An image or PDF in the library: the server reads text only.
  if (AsyncResult.isFailure(result)) {
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
        placeholder={disk === null ? "" : props.placeholder}
        readOnly={readOnly || disk === null}
        spellCheck={false}
        onChange={(event) => setDraft(nextSprintFileDraft(draft, view.value, event.target.value))}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "s") {
            event.preventDefault();
            void save();
          }
        }}
        data-testid="sprint-file-editor"
      />
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3.5 py-2">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {readOnly
            ? "Too long to edit here."
            : view.stale
              ? "The sprint changed this file since you began. Saving replaces its change."
              : view.dirty
                ? "Unsaved changes"
                : ""}
        </p>
        {view.stale ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => setDraft(null)}>
            Reload
          </Button>
        ) : view.dirty ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => setDraft(null)}>
            Discard
          </Button>
        ) : null}
        <Button
          type="button"
          size="xs"
          disabled={!view.dirty || saving || readOnly}
          onClick={() => void save()}
          data-testid="sprint-file-save"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
