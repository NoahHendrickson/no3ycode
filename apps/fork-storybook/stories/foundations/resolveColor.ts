// Computed colours come back in whatever space the CSS wrote them (oklch, color(srgb …), rgb), so
// each is painted onto a 1×1 canvas and read back as sRGB bytes: the hex a designer types.
let context: CanvasRenderingContext2D | null = null;

export interface ResolvedColor {
  readonly hex: string;
  readonly alpha: number;
}

export function resolveCssColor(css: string): ResolvedColor {
  context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!context) return { hex: css, alpha: 1 };
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  const hex = `#${[r, g, b].map((channel) => channel!.toString(16).padStart(2, "0")).join("")}`;
  return { hex, alpha: Math.round((a! / 255) * 100) / 100 };
}

/** The colour a custom property paints inside `scope`, read through a throwaway probe. */
export function readTokenColor(scope: Element, property: string): ResolvedColor {
  const probe = document.createElement("span");
  probe.style.color = `var(${property})`;
  scope.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return resolveCssColor(color);
}
