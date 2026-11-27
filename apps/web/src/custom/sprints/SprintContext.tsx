/**
 * A sprint's Library tab — see `.fork/customizations.yaml#fork-sprints`. Lists `context/` in the
 * sprint's folder (the owner's files and what its threads saved), adds files to it, and opens one
 * to read or edit. Removing one is a request to the sprint; the server has no delete call.
 */
import { useAtomValue } from "@effect/atom-react";
import type { ProjectListEntriesResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";

import { ChevronLeftIcon, PlusIcon } from "../icons/lucide-hugeicons";
import { SPRINT_CONTEXT_DIRECTORY } from "./sprintContextFiles";
import { SprintFileEditor } from "./SprintFileEditor";
import { useAddSprintContext } from "./useAddSprintContext";

const NO_LIST = Atom.make(AsyncResult.initial<ProjectListEntriesResult, never>(false)).pipe(
  Atom.withLabel("sprint-context:none"),
);

export function SprintContext(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly folder: string;
}) {
  const { environmentId } = props.sprintRef;
  const { canReadFiles } = useFilesystemReadAccess(environmentId);
  const addContext = useAddSprintContext();
  const fileInput = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  // Bumped after each add, so the list reads the folder again past the query's cache.
  const [revision, setRevision] = useState(0);
  const query = canReadFiles
    ? projectEnvironment.listEntries({
        environmentId,
        input: { cwd: props.folder, directoryPath: SPRINT_CONTEXT_DIRECTORY },
      })
    : NO_LIST;
  const result = useAtomValue(revisionedQuery(query, String(revision)));
  // A sprint gets the folder with its first file, so a failed read is an empty list.
  const files = AsyncResult.isSuccess(result)
    ? result.value.entries
        .filter((entry) => entry.kind === "file")
        .map((entry) => entry.path.split("/").pop() ?? entry.path)
        .toSorted((left, right) => left.localeCompare(right))
    : [];

  const add = async (list: FileList | null) => {
    if (list === null || list.length === 0) return;
    setAdding(true);
    await addContext({ environmentId, cwd: props.folder, folder: "" }, Array.from(list));
    setAdding(false);
    setRevision((current) => current + 1);
  };

  if (open !== null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 px-2 pt-2">
          <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(null)}>
            <ChevronLeftIcon />
            Library
          </Button>
          <span className="min-w-0 truncate text-sm text-foreground">{open}</span>
        </div>
        <SprintFileEditor
          sprintRef={props.sprintRef}
          folder={props.folder}
          relativePath={`${SPRINT_CONTEXT_DIRECTORY}/${open}`}
          description="In the sprint's library. The sprint and its threads read it when the work touches it."
          announceEdits={false}
        />
      </div>
    );
  }
  return (
    <div
      data-fork-sprint-context=""
      className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2.5"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        void add(event.dataTransfer.files);
      }}
    >
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Specs, notes, code, images or PDFs the sprint should know, and what its threads saved.
          Drop files here.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={adding || !canReadFiles}
          onClick={() => fileInput.current?.click()}
          data-testid="sprint-context-add"
        >
          <PlusIcon />
          Add files
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            void add(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {files.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="-mx-1.5 mt-2 flex flex-col">
          {files.map((file) => (
            <li key={file}>
              <button
                type="button"
                className="w-full truncate rounded-md px-1.5 py-1 text-left text-sm text-foreground hover:bg-accent"
                onClick={() => setOpen(file)}
              >
                {file}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
