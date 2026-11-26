/**
 * Cinnabar Studio live font — see `.fork/customizations.yaml#fork-cinnabar-live`.
 *
 * Dev builds only, and only when the dev server is started with VITE_CINNABAR_LIVE set (a Studio
 * URL, or "1" for http://127.0.0.1:8765). The Studio (the font's editor, in the cinnabar-interface repo)
 * recompiles a preview of the font after every edit and announces each version over server-sent
 * events. Each time, this fetches the new upright and italic files and swaps the
 * "Cinnabar Interface" faces in place, so the whole app re-renders in the edited font with no
 * reload.
 *
 * The bytes are fetched and handed to FontFace as an ArrayBuffer rather than loaded by URL: the
 * desktop renderer's CSP allows http: in connect-src but not in font-src, and a FontFace built from
 * a buffer makes no font fetch. Faces added through document.fonts come after the stylesheet's
 * @font-face rules for the same family and descriptors, so they win.
 */

import { FORK_DEFAULT_SANS_FAMILY } from "./forkTypographyScale";

const DEFAULT_STUDIO_URL = "http://127.0.0.1:8765";
const FILES = [
  { file: "CinnabarInterface.ttf", style: "normal" },
  { file: "CinnabarInterface-Italic.ttf", style: "italic" },
] as const;

export function cinnabarLiveStudioUrl(flag: string | undefined): string | null {
  const value = flag?.trim();
  if (!value || value === "0" || value === "false") return null;
  return value === "1" || value === "true" ? DEFAULT_STUDIO_URL : value.replace(/\/+$/u, "");
}

export function startCinnabarLive(): void {
  if (!import.meta.env.DEV) return;
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const studio = cinnabarLiveStudioUrl(env.VITE_CINNABAR_LIVE);
  if (studio === null || typeof EventSource === "undefined") return;

  let faces: FontFace[] = [];
  let shown = 0;

  async function swapTo(version: number): Promise<void> {
    if (version <= shown) return;
    const next = await Promise.all(
      FILES.map(async ({ file, style }) => {
        const response = await fetch(`${studio}/live/${file}?v=${version}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
        const face = new FontFace(FORK_DEFAULT_SANS_FAMILY, await response.arrayBuffer(), {
          style,
          weight: "100 900",
        });
        return face.load();
      }),
    );
    // A newer version may have landed while these loaded; never step backwards.
    if (version <= shown) return;
    for (const face of faces) document.fonts.delete(face);
    for (const face of next) document.fonts.add(face);
    faces = next;
    shown = version;
  }

  // EventSource retries a dropped connection on its own, but gives up for good on an HTTP error
  // (a Studio without /live, or one that restarted mid-request). Reopen it a few seconds later, so
  // the app follows whenever the Studio comes (back) up.
  const connect = (): void => {
    const events = new EventSource(`${studio}/live/events`);
    events.addEventListener("message", (event) => {
      const version = Number(event.data);
      if (Number.isFinite(version)) {
        swapTo(version).catch((error: unknown) => {
          console.warn("[cinnabar-live] couldn't load the Studio's live font", error);
        });
      }
    });
    events.addEventListener("error", () => {
      if (events.readyState === EventSource.CLOSED) setTimeout(connect, 5000);
    });
  };
  connect();
}
