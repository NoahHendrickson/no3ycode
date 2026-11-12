import { SidebarBrandMarkLowDensity } from "./SidebarBrandMarkLowDensity";

/**
 * Sidebar pixel mark — see `.fork/customizations.yaml#fork-sidebar-chrome`.
 *
 * The 21-cell flower from Figma t3-fork 676:42956: one 9x12 leaf, rotated into
 * four, painted bottom, right, top, left so the tips overlap into a pinwheel.
 * Each leaf has a body, a light run and its own dark outline, each filling from
 * a `--fork-brand-mark-*` variable with the design's colour as the fallback;
 * Westworld (theme.custom.palettes.css) restates them for its blues.
 *
 * Plain integer rects with crispEdges: a bitmap cannot land 21 cells on a 16px
 * slot without smearing every cell.
 */
function SidebarBrandMarkHighDensity() {
  return (
    <svg
      aria-hidden
      className="size-4 shrink-0"
      data-fork-brand-art="high"
      shapeRendering="crispEdges"
      viewBox="0 0 21 21"
    >
      <g fill="var(--fork-brand-mark-top-outline, #0e440c)">
        <rect height="1" width="3" x="9" y="0" />
        <rect height="1" width="1" x="8" y="1" />
        <rect height="1" width="1" x="10" y="1" />
        <rect height="1" width="1" x="12" y="1" />
        <rect height="1" width="1" x="7" y="2" />
        <rect height="1" width="1" x="10" y="2" />
        <rect height="1" width="1" x="13" y="2" />
        <rect height="1" width="1" x="6" y="3" />
        <rect height="1" width="1" x="10" y="3" />
        <rect height="1" width="1" x="14" y="3" />
        <rect height="1" width="1" x="6" y="4" />
        <rect height="1" width="1" x="8" y="4" />
        <rect height="1" width="1" x="10" y="4" />
        <rect height="1" width="1" x="12" y="4" />
        <rect height="1" width="1" x="14" y="4" />
        <rect height="1" width="1" x="6" y="5" />
        <rect height="1" width="3" x="9" y="5" />
        <rect height="1" width="1" x="14" y="5" />
        <rect height="1" width="1" x="10" y="6" />
        <rect height="1" width="1" x="14" y="6" />
        <rect height="1" width="1" x="10" y="7" />
        <rect height="1" width="1" x="12" y="7" />
        <rect height="1" width="1" x="14" y="7" />
        <rect height="1" width="1" x="14" y="8" />
        <rect height="1" width="1" x="13" y="9" />
        <rect height="1" width="1" x="12" y="10" />
      </g>
      <g fill="var(--fork-brand-mark-right-outline, #3e2e14)">
        <rect height="1" width="3" x="15" y="6" />
        <rect height="1" width="1" x="18" y="7" />
        <rect height="1" width="1" x="16" y="8" />
        <rect height="1" width="1" x="19" y="8" />
        <rect height="1" width="1" x="15" y="9" />
        <rect height="1" width="1" x="20" y="9" />
        <rect height="1" width="8" x="13" y="10" />
        <rect height="1" width="1" x="15" y="11" />
        <rect height="1" width="1" x="20" y="11" />
        <rect height="1" width="1" x="13" y="12" />
        <rect height="1" width="1" x="16" y="12" />
        <rect height="1" width="1" x="19" y="12" />
        <rect height="1" width="1" x="11" y="13" />
        <rect height="1" width="1" x="18" y="13" />
        <rect height="1" width="6" x="12" y="14" />
      </g>
      <g fill="var(--fork-brand-mark-bottom-outline, #4c3f0f)">
        <rect height="1" width="1" x="10" y="13" />
        <rect height="1" width="1" x="10" y="14" />
        <rect height="1" width="1" x="6" y="15" />
        <rect height="1" width="3" x="9" y="15" />
        <rect height="1" width="1" x="14" y="15" />
        <rect height="1" width="1" x="6" y="16" />
        <rect height="1" width="1" x="8" y="16" />
        <rect height="1" width="1" x="10" y="16" />
        <rect height="1" width="1" x="12" y="16" />
        <rect height="1" width="1" x="14" y="16" />
        <rect height="1" width="1" x="6" y="17" />
        <rect height="1" width="1" x="10" y="17" />
        <rect height="1" width="1" x="14" y="17" />
        <rect height="1" width="1" x="7" y="18" />
        <rect height="1" width="1" x="10" y="18" />
        <rect height="1" width="1" x="13" y="18" />
        <rect height="1" width="1" x="8" y="19" />
        <rect height="1" width="1" x="10" y="19" />
        <rect height="1" width="1" x="12" y="19" />
        <rect height="1" width="3" x="9" y="20" />
      </g>
      <g fill="var(--fork-brand-mark-left-outline, #0a2a18)">
        <rect height="1" width="6" x="3" y="6" />
        <rect height="1" width="1" x="2" y="7" />
        <rect height="1" width="1" x="9" y="7" />
        <rect height="1" width="1" x="1" y="8" />
        <rect height="1" width="1" x="4" y="8" />
        <rect height="1" width="1" x="7" y="8" />
        <rect height="1" width="1" x="10" y="8" />
        <rect height="1" width="1" x="0" y="9" />
        <rect height="1" width="1" x="5" y="9" />
        <rect height="1" width="1" x="11" y="9" />
        <rect height="1" width="12" x="0" y="10" />
        <rect height="1" width="1" x="0" y="11" />
        <rect height="1" width="1" x="5" y="11" />
        <rect height="1" width="1" x="8" y="11" />
        <rect height="1" width="1" x="11" y="11" />
        <rect height="1" width="1" x="1" y="12" />
        <rect height="1" width="1" x="4" y="12" />
        <rect height="1" width="1" x="7" y="12" />
        <rect height="1" width="1" x="10" y="12" />
        <rect height="1" width="1" x="2" y="13" />
        <rect height="1" width="1" x="9" y="13" />
        <rect height="1" width="6" x="3" y="14" />
      </g>
      <g fill="var(--fork-brand-mark-left, #008755)">
        <rect height="1" width="3" x="6" y="7" />
        <rect height="1" width="1" x="3" y="8" />
        <rect height="1" width="2" x="5" y="8" />
        <rect height="1" width="2" x="8" y="8" />
        <rect height="1" width="3" x="2" y="9" />
        <rect height="1" width="5" x="6" y="9" />
        <rect height="1" width="4" x="1" y="11" />
        <rect height="1" width="2" x="6" y="11" />
        <rect height="1" width="2" x="9" y="11" />
        <rect height="1" width="2" x="2" y="12" />
        <rect height="1" width="2" x="5" y="12" />
        <rect height="1" width="2" x="8" y="12" />
        <rect height="1" width="6" x="3" y="13" />
      </g>
      <g fill="var(--fork-brand-mark-left-light, #08b776)">
        <rect height="1" width="3" x="3" y="7" />
        <rect height="1" width="1" x="2" y="8" />
        <rect height="1" width="1" x="1" y="9" />
      </g>
      <g fill="var(--fork-brand-mark-top, #26b846)">
        <rect height="1" width="1" x="9" y="1" />
        <rect height="1" width="2" x="8" y="2" />
        <rect height="1" width="1" x="11" y="2" />
        <rect height="1" width="3" x="7" y="3" />
        <rect height="1" width="2" x="11" y="3" />
        <rect height="1" width="1" x="7" y="4" />
        <rect height="1" width="1" x="9" y="4" />
        <rect height="1" width="1" x="11" y="4" />
        <rect height="1" width="2" x="7" y="5" />
        <rect height="1" width="1" x="12" y="5" />
        <rect height="1" width="1" x="9" y="6" />
        <rect height="1" width="3" x="11" y="6" />
        <rect height="1" width="1" x="11" y="7" />
        <rect height="1" width="1" x="13" y="7" />
        <rect height="1" width="3" x="11" y="8" />
        <rect height="1" width="1" x="12" y="9" />
      </g>
      <g fill="var(--fork-brand-mark-top-light, #3aed62)">
        <rect height="1" width="1" x="11" y="1" />
        <rect height="1" width="1" x="12" y="2" />
        <rect height="1" width="1" x="13" y="3" />
        <rect height="1" width="1" x="13" y="4" />
        <rect height="1" width="1" x="13" y="5" />
      </g>
      <g fill="var(--fork-brand-mark-right, #f95b1c)">
        <rect height="1" width="3" x="15" y="7" />
        <rect height="1" width="1" x="15" y="8" />
        <rect height="1" width="2" x="17" y="8" />
        <rect height="1" width="1" x="14" y="9" />
        <rect height="1" width="4" x="16" y="9" />
        <rect height="1" width="3" x="12" y="11" />
        <rect height="1" width="3" x="16" y="11" />
        <rect height="1" width="2" x="11" y="12" />
        <rect height="1" width="2" x="14" y="12" />
        <rect height="1" width="1" x="17" y="12" />
        <rect height="1" width="3" x="12" y="13" />
      </g>
      <g fill="var(--fork-brand-mark-bottom, #fcb01a)">
        <rect height="1" width="1" x="9" y="14" />
        <rect height="1" width="1" x="11" y="14" />
        <rect height="1" width="1" x="8" y="15" />
        <rect height="1" width="2" x="12" y="15" />
        <rect height="1" width="1" x="9" y="16" />
        <rect height="1" width="1" x="11" y="16" />
        <rect height="1" width="1" x="13" y="16" />
        <rect height="1" width="2" x="8" y="17" />
        <rect height="1" width="3" x="11" y="17" />
        <rect height="1" width="1" x="9" y="18" />
        <rect height="1" width="2" x="11" y="18" />
        <rect height="1" width="1" x="11" y="19" />
      </g>
      <g fill="var(--fork-brand-mark-right-light, #ff8f0c)">
        <rect height="1" width="1" x="19" y="11" />
        <rect height="1" width="1" x="18" y="12" />
        <rect height="1" width="3" x="15" y="13" />
      </g>
      <g fill="var(--fork-brand-mark-bottom-light, #ffd233)">
        <rect height="1" width="1" x="7" y="15" />
        <rect height="1" width="1" x="7" y="16" />
        <rect height="1" width="1" x="7" y="17" />
        <rect height="1" width="1" x="8" y="18" />
        <rect height="1" width="1" x="9" y="19" />
      </g>
    </svg>
  );
}

export function SidebarBrandMark() {
  return (
    <>
      <SidebarBrandMarkHighDensity />
      <SidebarBrandMarkLowDensity />
    </>
  );
}
