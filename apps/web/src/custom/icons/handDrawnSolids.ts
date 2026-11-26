// Filled weights drawn after Hugeicons' solid set where the derivation can't reach it: back
// panels and handles that are open strokes, pieces that should stand apart behind a gap, and
// dividers that run where the outline has none. Each reuses the outline glyph's own geometry.
import * as Hg from "@hugeicons/core-free-icons";

import type { GlyphDrawing, IconSvgElement } from "./hugeiconsFill";

type Element = IconSvgElement[number];

/** The gap left round a part that sits in front of another. */
const GAP = 1.25;
/** A seam between two parts that meet edge to edge. */
const SEAM = 1.5;
/** A detail cut into a body; at 12px a narrower cut is under a pixel. */
const DETAIL = 2;

const pathOf = (glyph: IconSvgElement, index: number) => String(glyph[index]![1]["d"]);
const body = (key: string, d: string, extra: Record<string, string | number> = {}): Element => [
  "path",
  { d, fill: "currentColor", stroke: "none", ...extra, key },
];
const cut = (key: string, d: string, width: number): Element => [
  "path",
  { d, fill: "none", stroke: "black", strokeWidth: width, key },
];
/** Cuts a gap round `front`, then restores `front` itself, so only what lies behind it is cut. */
const around = ([tag, attrs]: Element, gap = GAP): Element[] => [
  [
    tag,
    { ...attrs, fill: "none", stroke: "black", strokeWidth: 2 * gap, key: `${attrs["key"]}-gap` },
  ],
  [tag, { ...attrs, fill: "white", stroke: "none", key: `${attrs["key"]}-front` }],
];
const solid = (bodies: Element[], knockouts: Element[] = []): GlyphDrawing => ({
  bodies,
  knockouts,
  holes: [],
  plain: [],
});

export const FolderClosedSolid = solid(
  [body("folder", pathOf(Hg.FolderClosedIcon, 0))],
  [
    [
      "path",
      {
        d: "M1 10.5H23",
        stroke: "black",
        strokeWidth: SEAM,
        strokeLinecap: "butt",
        key: "divider",
      },
    ],
  ],
);

const FOLDER_OPEN_FLAP =
  "M3.93802 21H14.9395C17.1335 21 18.2305 21 19.0351 20.3884C19.8398 19.7768 20.1334 18.7198 20.7206 16.6059L21.9197 12.289C21.973 12.0972 22 11.8991 22 11.7001C22 10.485 21.015 9.5 19.7999 9.5H12.5634C10.5123 9.5 9.48671 9.5 8.71918 10.0273C8.59312 10.1139 8.47387 10.21 8.36246 10.3148C7.68418 10.9528 7.46632 11.9549 7.03061 13.9592L5.83181 19.4737C5.63814 20.3646 4.84972 21 3.93802 21Z";
export const FolderOpenSolid = solid(
  [
    // The back panel, closed under the flap so the two overlap rather than abut.
    body(
      "back",
      "M3.93802 21C2.86768 21 2 20.1323 2 19.062V7.76613C2 5.53633 2 4.42144 2.68424 3.72186C2.69664 3.70918 2.70918 3.69664 2.72186 3.68424C3.42144 3 4.53633 3 6.76613 3C7.37053 3 7.67273 3 7.94502 3.11102C7.95015 3.11311 7.95527 3.11523 7.96038 3.11738C8.23142 3.23142 8.4451 3.4451 8.87248 3.87248L9.62132 4.62132C10.0549 5.05487 10.2716 5.27164 10.5473 5.38582C10.823 5.5 11.1295 5.5 11.7426 5.5H16.5C17.5245 5.5 18.0367 5.5 18.4454 5.65383C19.0922 5.89728 19.6027 6.40776 19.8462 7.0546C20 7.46331 20 7.97554 20 9V11H9L7 17.5L6 21Z",
    ),
    body("flap", FOLDER_OPEN_FLAP),
  ],
  [
    // Only along the flap's top and front edge, stopping short of the hinge.
    cut(
      "gap",
      "M19.7999 9.5H12.5634C10.5123 9.5 9.48671 9.5 8.71918 10.0273C8.59312 10.1139 8.47387 10.21 8.36246 10.3148C7.68418 10.9528 7.46632 11.9549 7.03061 13.9592L6.207 17.75",
      2 * GAP,
    ),
    ["path", { d: FOLDER_OPEN_FLAP, fill: "white", stroke: "none", key: "flap" }],
  ],
);

const foldersFront = body("front", pathOf(Hg.FoldersIcon, 0));
export const FoldersSolid = solid(
  [
    // The back folder, closed under the front one.
    body(
      "back",
      `${pathOf(Hg.FoldersIcon, 1).replace(/^M[\d.]+ [\d.]+/, "M16 15.4976L20.4999 15.4976")}L7 12L16 12Z`,
    ),
    foldersFront,
  ],
  around(foldersFront),
);

// Both racks are Hugeicons' top rack squeezed to 7 units, so each keeps its corners all round.
const rack = pathOf(Hg.ServerIcon, 0);
export const ServerSolid = solid(
  [
    body("top", rack, { transform: "matrix(1 0 0 0.875 0 0.5)" }),
    body("bottom", rack, { transform: "matrix(1 0 0 0.875 0 9.5)" }),
  ],
  [
    [6, 7.5],
    [10, 7.5],
    [6, 16.5],
    [10, 16.5],
  ].map(([cx, cy]): Element => [
    "circle",
    { cx: cx!, cy: cy!, r: 1, fill: "black", stroke: "none", key: `${cx}-${cy}` },
  ]),
);

// The person behind is the front one moved 4 units right; only the outline shows it partly.
const usersHead: Element = [
  "circle",
  { cx: 10, cy: 7.5, r: 3.5, fill: "currentColor", stroke: "none", key: "head" },
];
// The shoulders, closed along the feet with the outline's round caps kept as small radii.
const USERS_BODY = pathOf(Hg.UsersIcon, 0)
  .replace(/^M16\.5 20V/, "M15.75 20Q16.5 20 16.5 19.25V")
  .replace(/V20$/, "V19.25Q3.5 20 4.25 20Z");
const usersBody = body("body", USERS_BODY);
export const UsersSolid = solid(
  [
    ["circle", { cx: 14, cy: 7.5, r: 3.5, fill: "currentColor", stroke: "none", key: "back-head" }],
    body("back-body", USERS_BODY, { transform: "translate(4 0)" }),
    usersHead,
    usersBody,
  ],
  [...around(usersHead), ...around(usersBody)],
);

export const PackageSolid = solid(
  [
    body("lid", pathOf(Hg.PackageIcon, 1)),
    body(
      "sides",
      "M3 7V17.1613C3 18.5438 4.94564 19.3657 8.83693 21.0095C10.4002 21.6698 11.1818 22 12 22C12.8182 22 13.5998 21.6698 15.1631 21.0095C19.0544 19.3657 21 18.5438 21 17.1613V7L12 11Z",
    ),
  ],
  [
    cut(
      "lid-edge",
      "M1.5 6.5H3C3 7.11423 3.80157 7.5021 5.40472 8.27785L8.32592 9.69138C10.1288 10.5638 11.0303 11 12 11C12.9697 11 13.8712 10.5638 15.6741 9.69138L18.5953 8.27785C20.1984 7.5021 21 7.11423 21 6.5H22.5",
      SEAM,
    ),
    cut("corner", "M12 11V23", SEAM),
    cut("strap", "M17 4L7 9", SEAM),
    cut("label", "M6 12L8 13", SEAM),
  ],
);

export const ScrollTextSolid = solid(
  [
    body("curl", pathOf(Hg.ScrollTextIcon, 0)),
    body(
      "page",
      "M4 3H14.9922C16.8778 3 17.8206 3 18.4064 3.58579C18.9922 4.17157 18.9922 5.11438 18.9922 7V17H9.99219V19C9.99219 20.1046 9.09676 21 7.99219 21C6.88762 21 5.99219 20.1046 5.99219 19V5H4Z",
    ),
    body("roll", pathOf(Hg.ScrollTextIcon, 1)),
  ],
  [
    cut("curl-seam", "M5.99219 9V5C5.99219 3.89543 5.09676 3 3.99219 3", SEAM),
    cut(
      "roll-seam",
      "M7.99219 21C9.09676 21 9.99219 20.1046 9.99219 19V18C9.99219 17.0572 9.99219 16.5858 10.2851 16.2929C10.578 16 11.0494 16 11.9922 16H18.9922",
      SEAM,
    ),
    cut("line-1", "M9.99219 8H14.9922", DETAIL),
    cut("line-2", "M9.99219 11H12.9922", DETAIL),
  ],
);

export const ArchiveArrowUpSolid = solid(
  [
    body("lid", pathOf(Hg.ArchiveArrowUpIcon, 1)),
    body("box", `${pathOf(Hg.ArchiveArrowUpIcon, 2)}Z`),
  ],
  [
    cut("seam", "M1.5 8H22.5", SEAM),
    cut("shaft", "M12 13V22", DETAIL),
    cut("head", "M15 15C15 15 12.7905 12 12 12C11.2094 12 9 15 9 15", DETAIL),
  ],
);

const pipetteCollar = body("collar", pathOf(Hg.PipetteIcon, 1));
export const PipetteSolid = solid(
  [
    body("tube", `${pathOf(Hg.PipetteIcon, 0)}Z`),
    // The bulb, closed inside the collar.
    body("bulb", `${pathOf(Hg.PipetteIcon, 2)}L17 11L13 7Z`),
    pipetteCollar,
  ],
  around(pipetteCollar, 1),
);

const hammerHead = body("head", pathOf(Hg.HammerIcon, 1));
export const HammerSolid = solid(
  [body("handle", `${pathOf(Hg.HammerIcon, 0)}Z`), hammerHead],
  around(hammerHead, 1),
);

const [rulerLower, rulerUpper] = pathOf(Hg.PencilRulerIcon, 0)
  .split(/(?=M)/)
  .map((d) => `${d}Z`);
const pencil = body("pencil", pathOf(Hg.PencilRulerIcon, 2));
export const PencilRulerSolid = solid(
  [
    body("ruler-lower", rulerLower!),
    body("ruler-upper", rulerUpper!),
    body("cap", `${pathOf(Hg.PencilRulerIcon, 1)}Z`),
    pencil,
  ],
  [...around(pencil, 1), cut("ticks", pathOf(Hg.PencilRulerIcon, 3), SEAM)],
);

// The notch, filled, reads as a bite out of the edge; Hugeicons' solid phone has an island.
export const SmartphoneSolid = solid(
  [body("phone", pathOf(Hg.SmartphoneIcon, 0))],
  [cut("island", "M10.75 4.75H13.25", SEAM)],
);
