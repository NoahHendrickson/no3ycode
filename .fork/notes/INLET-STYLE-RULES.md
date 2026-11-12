# Inlet style guide

How the **Inlet** theme (`data-fork-theme="inlet"`) should look and feel. Part 1 describes the
style in plain terms; use judgement there. Part 2 lists the **hard rules**: exact specs that Noey
has signed off on and that new work must follow as written. Change a hard rule only when Noey asks,
then update this file.

Code: `apps/web/src/theme.custom.inlet.css` (the template), `theme.custom.inlet-menus.css`
(hung menus, tooltips, tab strip), `theme.custom.inlet-jungle.css` (Jungle Art and Jungle Light),
`theme.custom.inlet-black.css` (Black),
`theme.custom.palettes.css` (per-colour tokens), `custom/inletMenuMorph.ts` (menu motion). Figma `t3-fork`: 619:6610
(Charcoal), 629:8337 (Green), 630:10946 (Jungle Art), 630:14154 (Cream / Black).

---

## Part 1 — The feel

**Everything that opens from something stays attached to it.** Inlet is flat, solid surfaces that
are set into each other or grow out of each other, joined by soft concave curves. Nothing floats
when it could connect.

### Concave and curvy

Shapes meet with an inward curve, not a hard corner or a gap. The open thread's row flows into the
chat panel; a menu flows out of its button; a selected tab flows into the content beside it. Curves
are generous and soft, never pinched or notched. When something looks tight, it usually needs a
wider curve.

### Connected

A menu, popover or card belongs to the thing that opened it. Its button takes on the menu's colour
and they read as one piece. Connections are short: a popover sits close to its button instead of
hanging off a long stem. Only one connection shows at a time.

### Inset

Content is set _into_ surfaces rather than stacked on them. The chat panel is set into the frame.
The model list is set into its menu with an even ring around it. Pickers and sliders are recessed
wells with the selection sitting inside. Use inset sparingly: one level is calm, while panels inside
panels inside panels feel busy. When in doubt, put content directly on the surface.

### Solid and flat

Surfaces are solid colours. Inlet never uses frosted glass or translucency, and shadows are faint
and only lift a piece off what's behind it. The one exception is Jungle Art's composer, which is glass:
light glass over the new-agent picture, a faint white over the charcoal stage in a thread. Each surface should be clearly its own colour against
its neighbour, so a menu never melts into the composer it opens over.

### Quiet ink

Text and icons are calm and readable. Faint text is still easy to read, and icons are filled, simple
shapes. Status colours stay legible on every frame, light or dark.

### Fluid motion

Things grow out of where they're attached, and fold back into it. Each movement is one smooth shape
doing one thing. Nothing pops, blinks, snaps, or leaves pieces behind. Motion is a moment of feedback,
never decoration that keeps running.

### Rounded, not round

Corners are soft, but controls aren't blobs. Chips and icon buttons are rounded rectangles, not
full pills or circles. Nested shapes keep their curves parallel.

---

## Part 2 — Hard rules

### H1. Menu motion: the one-shape morph

Every Inlet dropdown opens and closes with the morph in `custom/inletMenuMorph.ts`. That covers the
sidebar header menus, tab strip menus, composer chips, and the model, mode and usage menus. Noey
chose it over held fills, scale-and-fade sheets and CSS clip-path folds, which all read as two
things moving out of step. A new dropdown uses this morph. Don't build another menu animation.

- The **button, the join and the menu are drawn as a single shape**, so they can't fall out of
  step. The static menu background, shadow and join, and the button's fill, are off while it runs.
  A copy of the button is drawn on top so its label stays visible.
- Choreography, over one progress value (0 = the button alone, 1 = fully open):

  | Part                              | Progress    | Curve             |
  | --------------------------------- | ----------- | ----------------- |
  | Shape and button fill fade in     | 0 → 0.22    | linear            |
  | Height grows out of the button    | 0.08 → 1    | ease-in-out cubic |
  | Width spreads to the menu's width | 0.12 → 0.72 | ease-in-out cubic |
  | Menu content fades in             | 0.62 → 1    | linear            |

- **Open 520ms, ease-out cubic. Close 280ms, ease-in-out sine.** Closing plays the path backwards.
  A reversal mid-flight continues from the current progress, and its time scales with the distance
  left.
- Colour and corner radius come from the menu's own computed style, never from constants.
- Menus that open upward use the same shape flipped. A menu that collision-flips onto its button
  skips the morph.
- **No first-frame blink:** a menu stays hidden until the morph claims it, and is released to its
  static look if the morph can't.
- Anything nearby that has to move does so in step with the morph. The usage meter slides 8px: out
  over 420ms; back after a 190ms delay over 220ms.

### H2. Motion everywhere

- **One motion, not two.** A trigger and the thing it opens start and end together.
- **No tails.** Nothing may linger after the thing it's attached to has gone.
- **Closing is one continuous curve.** No fade-only closes and no two-phase (width-then-height)
  closes.
- **The settled state is pixel-exact.** Remove animation clips and transforms when motion ends.
- **Nothing loops or repaints continuously.** Every animation runs once per open or close.
- **Off under Reduce Motion**, with no exceptions.

### H3. The connection

The sidebar Threads header's **settings (gear) menu is the reference**. Every connected menu must
look like it. While open:

1. The trigger takes the menu's **exact** fill and ink, and squares the side facing the menu.
2. The menu squares the corner over the trigger and fills the gap to it.
3. A concave corner curves from the menu's edge into the trigger's free side.
4. Menu, join and trigger **sample as the same hex.** No shadow may land on the trigger: cast it
   away, and clip it at the join. A menu hung above its trigger (the composer's) casts none,
   or it falls on the chips beside the trigger.
5. A thin trigger gets padded fill (4px each side), so the menu never hangs off a sliver.

### H4. Geometry

| Token                                                                         | Value                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------- |
| Frame margin around the chat panel (`--fork-inlet-margin`)                    | **8px**                                     |
| Panel corners (`--fork-inlet-radius`)                                         | **8px**                                     |
| Menu and popover corners (`--fork-inlet-menu-radius`)                         | **10px**                                    |
| Menu rows (5px in from the menu edge)                                         | **5px**                                     |
| Default concave corner (`--fork-inlet-fillet`)                                | **9px**                                     |
| Concave corner beside composer chips (`--fork-inlet-chip-fillet`)             | **12px**                                    |
| Concave corner in the model menu's provider rail (`--fork-inlet-rail-fillet`) | **6px**                                     |
| Composer vessel / chips / icon buttons                                        | **12px / 8px / 28px box with `rounded-lg`** |

- **Nested radii are parallel:** inner = outer − inset.
- **Corners that meet match.** For example, the model shell (10px) matches its open button.
- **A concave corner only meets a square edge.** A rounded edge beside it makes horns.
- **A gap between inset panels equals the ring around them.**
- **Every value is one variable.** Change it in one place, and everything follows.

### H5. Colour

- **Menus, popovers and tooltips are solid.** Never use glass, blur or translucency.
- **Ship solid tokens.** Flatten alphas into hex (black 65% on cream = `#55544c`).
- **A menu's colour differs from the surface it opens over.**
- **Never scope to `.dark`.** Each colour declares its own mode. When a surface flips polarity, it
  restates the contrast inks (`--contrast-foreground` and friends), not just `--foreground`.

### H6. Ink

- Faint text, labels and muted icons on cream frames: **black at 65%**.
- Unchecked checkbox in a menu: an outline only, in menu ink at **24%**.
- Anything you read reaches **4.5:1** (disabled controls are exempt). On light surfaces, status
  colours use deep shades.

### H7. Icons

- **Filled icons**, never duotone, on every Inlet colour.
- Icon buttons are **rounded squares, never circles**, the same size as the stage's details button
  (28px box, 16px glyph).

---

## Reference

### Colours

Exact tokens live in `theme.custom.palettes.css`; this is the personality of each.

| Colour       | Mode               | Frame / panel                                 | Character                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charcoal     | dark               | `#232322` / `#303235`                         | The original template.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Green        | light              | `#21835c` / cream `#f1f0e0`                   | A saturated frame around a cream stage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Jungle Art   | dark, light chrome | cream `#f2f0d8` / `#141414`, art on new agent | Cream's charcoal stage, open row and bridge in threads and the docked right panel; the art shows only on the new-agent screen, fading from the charcoal on its left edge, so no transcript scrolls over it. Accent green `#21835c` for menus, tooltips, send and dictation; the composer is glass (see Solid and flat); multi-selected rows `#4a9975`. Settings is cream (`#f6f4e4` page, `#f2f0d8` nav); the Usage and Automations pages are a `#f2f0d8` card set 8px into a charcoal stage that runs to the window's edges (its sidebar-side corners rounded 16px), which the lit row bridges into. |
| Jungle Light | light              | art behind green / Green's stage              | Jungle Art inside out.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Cream        | dark, light chrome | `#f8f3d8` / `#141414`                         | Black's mirror.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Black        | light              | `#141414` / `#f8f3d8`                         | Cream's mirror.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Current direction (not yet locked)

These look the way Noey wants them to right now, but are still being tuned:

- **Tooltips:** pill-like 14px corners and 6px / 12px padding. A nub with long, gradual sloping
  shoulders into a round tip (44px wide, 7px deep), landing at the trigger. Tooltips beside their trigger (left or right) have no tail: the pill's round end has no flat edge for one. They grow out of the
  nub.
- **Reasoning slider (Jungle):** the original dots and fill inside a recessed well; a fat 22px
  cream knob.
- **Mode picker:** recessed well; the selected segment is a cream fill.
- **Dictation:** one plain pill that grows right from the mic, and retracts into it in one move, its fill fading as it lands. No spring: a second shrink after the retract read as a stutter.
- **Brand:** the logo is 24px; its outline is `#3a3934` on cream frames. Light chrome tells macOS
  the window is light, so the traffic lights don't glow.
- **Header:** no project or thread breadcrumb.
- **Sidebar peek (collapsed):** the card hangs from the toggle as a tab, one step off the frame (lighter cream on cream frames, a step toward the ink on the others; padded
  4px, 4px drop, concave corner), with no tail or outline; the toggle's tooltip hides while it is open.

### Tried and rejected

- Frosted or translucent menus.
- Cream-on-cream menus, or a menu that matches the composer.
- Dark green user messages.
- Full-pill chips and circular icon buttons.
- Extra inset panels (behind the reasoning section, or inside the mode menu).
- A chunky ink-line slider.
- A mic block fused to the waveform.
- A loud green hover card on Jungle Art.
- Long connector stems.
- Shadows that darken their trigger.
- Fade-only, two-step, or tail-leaving close animations.

---

## Before calling an Inlet change done

1. Does it feel like Part 1? Does it follow every hard rule in Part 2?
2. Sample the pixels where things connect, and zoom into the concave corners.
3. Check all six colours, not just the one in the screenshot.
4. Check the hover, selected and open states for vanished ink.
5. Update the `fork-inlet-theme` manifest entry, the guard test
   (`__fork_guards__/forkInletTheme.test.ts`) and, if a rule changed, this file.
