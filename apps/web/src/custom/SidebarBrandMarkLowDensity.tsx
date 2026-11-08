/**
 * The sidebar flower under 1.5x: one device pixel per cell at 1x, 1-2 at 1.25x.
 * SidebarBrandMark's 23-cell art cannot land on 16 pixels: crispEdges has to drop
 * cells. 15 rows because the brand link clips to 16px; odd keeps the centre cross.
 */
export function SidebarBrandMarkLowDensity() {
  return (
    <svg
      aria-hidden
      className="hidden h-4 w-[15px] shrink-0 [@media(max-resolution:1.49dppx)]:block"
      preserveAspectRatio="xMidYMin meet"
      shapeRendering="crispEdges"
      viewBox="0 0 15 15"
    >
      <g fill="#000000">
        <rect height="1" width="3" x="6" y="0" />
        <rect height="1" width="1" x="5" y="1" />
        <rect height="1" width="1" x="7" y="1" />
        <rect height="1" width="1" x="9" y="1" />
        <rect height="1" width="1" x="4" y="2" />
        <rect height="1" width="1" x="7" y="2" />
        <rect height="1" width="1" x="10" y="2" />
        <rect height="1" width="1" x="4" y="3" />
        <rect height="1" width="1" x="7" y="3" />
        <rect height="1" width="1" x="10" y="3" />
        <rect height="1" width="4" x="2" y="4" />
        <rect height="1" width="1" x="7" y="4" />
        <rect height="1" width="4" x="9" y="4" />
        <rect height="1" width="1" x="1" y="5" />
        <rect height="1" width="3" x="6" y="5" />
        <rect height="1" width="1" x="13" y="5" />
        <rect height="1" width="1" x="0" y="6" />
        <rect height="1" width="1" x="7" y="6" />
        <rect height="1" width="1" x="14" y="6" />
        <rect height="1" width="15" x="0" y="7" />
        <rect height="1" width="1" x="0" y="8" />
        <rect height="1" width="1" x="7" y="8" />
        <rect height="1" width="1" x="14" y="8" />
        <rect height="1" width="1" x="1" y="9" />
        <rect height="1" width="3" x="6" y="9" />
        <rect height="1" width="1" x="13" y="9" />
        <rect height="1" width="4" x="2" y="10" />
        <rect height="1" width="1" x="7" y="10" />
        <rect height="1" width="4" x="9" y="10" />
        <rect height="1" width="1" x="4" y="11" />
        <rect height="1" width="1" x="7" y="11" />
        <rect height="1" width="1" x="10" y="11" />
        <rect height="1" width="1" x="4" y="12" />
        <rect height="1" width="1" x="7" y="12" />
        <rect height="1" width="1" x="10" y="12" />
        <rect height="1" width="1" x="5" y="13" />
        <rect height="1" width="1" x="7" y="13" />
        <rect height="1" width="1" x="9" y="13" />
        <rect height="1" width="3" x="6" y="14" />
      </g>
      <g fill="var(--fork-brand-mark-top, #26b846)">
        <rect height="1" width="1" x="6" y="1" />
        <rect height="1" width="2" x="5" y="2" />
        <rect height="1" width="1" x="8" y="2" />
        <rect height="1" width="2" x="5" y="3" />
        <rect height="1" width="1" x="8" y="3" />
        <rect height="1" width="1" x="6" y="4" />
        <rect height="1" width="1" x="8" y="4" />
      </g>
      <g fill="var(--fork-brand-mark-top-light, #3aed62)">
        <rect height="1" width="1" x="8" y="1" />
        <rect height="1" width="1" x="9" y="2" />
        <rect height="1" width="1" x="9" y="3" />
      </g>
      <g fill="var(--fork-brand-mark-left, #008755)">
        <rect height="1" width="1" x="5" y="5" />
        <rect height="1" width="5" x="2" y="6" />
        <rect height="1" width="6" x="1" y="8" />
        <rect height="1" width="4" x="2" y="9" />
      </g>
      <g fill="var(--fork-brand-mark-left-light, #08b776)">
        <rect height="1" width="3" x="2" y="5" />
        <rect height="1" width="1" x="1" y="6" />
      </g>
      <g fill="var(--fork-brand-mark-right, #f95b1c)">
        <rect height="1" width="4" x="9" y="5" />
        <rect height="1" width="6" x="8" y="6" />
        <rect height="1" width="5" x="8" y="8" />
        <rect height="1" width="2" x="9" y="9" />
      </g>
      <g fill="var(--fork-brand-mark-right-light, #ff8f0c)">
        <rect height="1" width="1" x="13" y="8" />
        <rect height="1" width="2" x="11" y="9" />
      </g>
      <g fill="var(--fork-brand-mark-bottom, #fcb01a)">
        <rect height="1" width="1" x="8" y="10" />
        <rect height="1" width="1" x="6" y="11" />
        <rect height="1" width="2" x="8" y="11" />
        <rect height="1" width="1" x="6" y="12" />
        <rect height="1" width="2" x="8" y="12" />
        <rect height="1" width="1" x="8" y="13" />
      </g>
      <g fill="var(--fork-brand-mark-bottom-light, #ffd233)">
        <rect height="1" width="1" x="6" y="10" />
        <rect height="1" width="1" x="5" y="11" />
        <rect height="1" width="1" x="5" y="12" />
        <rect height="1" width="1" x="6" y="13" />
      </g>
    </svg>
  );
}
