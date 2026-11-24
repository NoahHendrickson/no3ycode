import type { SVGProps } from "react";

/**
 * Fork brand glyph — see `.fork/customizations.yaml#fork-brand-name`. The no3y flower as
 * currentColor line art (the outline cells of assets/fork/n3-favicon.svg, one per pixel at 16px)
 * where upstream draws its "T3" letters: its own tool rows and the standalone auth pages.
 */
export function T3Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="-0.5 -0.5 16 16"
      shapeRendering="crispEdges"
      data-fork-brand-glyph=""
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 0h1v1h-1zM7 0h1v1h-1zM8 0h1v1h-1zM5 1h1v1h-1zM7 1h1v1h-1zM9 1h1v1h-1zM4 2h1v1h-1zM7 2h1v1h-1zM10 2h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM7 3h1v1h-1zM9 3h1v1h-1zM10 3h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM8 4h1v1h-1zM10 4h1v1h-1zM11 4h1v1h-1zM12 4h1v1h-1zM1 5h1v1h-1zM4 5h1v1h-1zM7 5h1v1h-1zM10 5h1v1h-1zM11 5h1v1h-1zM13 5h1v1h-1zM0 6h1v1h-1zM5 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM14 6h1v1h-1zM0 7h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1zM9 7h1v1h-1zM10 7h1v1h-1zM11 7h1v1h-1zM12 7h1v1h-1zM13 7h1v1h-1zM14 7h1v1h-1zM0 8h1v1h-1zM5 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM4 9h1v1h-1zM7 9h1v1h-1zM11 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM3 10h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM8 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM11 10h1v1h-1zM12 10h1v1h-1zM4 11h1v1h-1zM5 11h1v1h-1zM7 11h1v1h-1zM9 11h1v1h-1zM10 11h1v1h-1zM4 12h1v1h-1zM7 12h1v1h-1zM10 12h1v1h-1zM5 13h1v1h-1zM7 13h1v1h-1zM9 13h1v1h-1zM6 14h1v1h-1zM7 14h1v1h-1zM8 14h1v1h-1z"
        fill="currentColor"
      />
    </svg>
  );
}
