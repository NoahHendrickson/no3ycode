/**
 * A sprint's library — see `.fork/customizations.yaml#fork-sprints`. Reference material the owner
 * adds (specs, notes, code, images, PDFs), copied into `context/` in the sprint's folder, which
 * keeps its first name so existing sprints' hooks and paths still hold. Binary files go as base64.
 */
export const SPRINT_CONTEXT_DIRECTORY = "context";

const MAX_TEXT_FILE_BYTES = 1_000_000;
const MAX_BINARY_FILE_BYTES = 20_000_000;

export type ContextFileRead =
  | {
      readonly kind: "file";
      readonly name: string;
      readonly contents: string;
      readonly encoding: "utf8" | "base64";
    }
  | { readonly kind: "skipped"; readonly name: string; readonly reason: "large" };

/** A file name that stays one entry inside `context/`: no folders, no hidden files. */
export function contextFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/^\.+/, "");
  return cleaned === "" ? "file" : cleaned;
}

/** The file as text, or null when it holds a NUL byte or is not valid UTF-8. */
export function decodeContextText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Chunked, since spreading megabytes into String.fromCharCode overflows the stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
}

/** Text up to 1 MB as UTF-8; anything else (images, PDFs) up to 20 MB as base64. */
export async function readContextFile(file: File): Promise<ContextFileRead> {
  const name = contextFileName(file.name);
  if (file.size > MAX_BINARY_FILE_BYTES) return { kind: "skipped", name, reason: "large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = file.size > MAX_TEXT_FILE_BYTES ? null : decodeContextText(bytes);
  return text === null
    ? { kind: "file", name, contents: bytesToBase64(bytes), encoding: "base64" }
    : { kind: "file", name, contents: text, encoding: "utf8" };
}

/** One line for a toast naming the files that were not copied. */
export function skippedContextSummary(read: ReadonlyArray<ContextFileRead>): string | null {
  const large = read.filter((file) => file.kind === "skipped");
  return large.length === 0
    ? null
    : `${large.map((file) => file.name).join(", ")}: larger than 20 MB.`;
}
