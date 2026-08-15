# LightOps v2 Tool Workspaces — Visual Redesign

## Decision

Redesign Resize, Minimize, Sequence Grouper, Metadata Cleaner, and Before/After Packager as guided workspaces that share the visual and interaction grammar of Ingest & Rename. Preserve every processing contract and backend call.

Three approaches were considered:

1. **Cosmetic polish only** — restyle the existing two-column forms. Lowest risk, but it preserves the weak hierarchy and does not feel related to Ingest.
2. **Shared workflow system** — use a common rail, step frame, sticky actions, status, and result language while giving each tool purpose-built steps. This is the selected approach because it creates product coherence without forcing every tool into identical content.
3. **Fully bespoke workspace per tool** — maximum visual freedom, but duplicates interaction code and makes future tools harder to add consistently.

## Visual direction

The product should feel like a photographer's digital light table: calm, technical, and image-first. The background, typography, radii, glass surfaces, and restrained violet atmosphere come directly from Ingest & Rename.

Each tool retains one identifying accent:

- Resize: cyan.
- Minimize: emerald.
- Sequence Grouper: amber.
- Metadata Cleaner: rose.
- Before/After: indigo.

Accent color appears in the tool glyph, active step, progress, selected technical controls, and key metrics. It must not recolor the entire workspace.

Typography remains Space Grotesk for headings, Inter for interface text, and JetBrains Mono for dimensions, sizes, quality, confidence, and paths. This preserves the existing LightOps identity rather than introducing a second design system.

## Shared workspace anatomy

Every workspace uses the same outer structure as Ingest:

- A left workflow rail with Back to Toolbox, tool identity, numbered/completed steps, current job status, and a concise local-first note.
- A bordered main surface with a fixed step header, internally scrolling content, and a fixed action footer.
- No page-level scrolling at 900×640 or 1200×780.
- Visible keyboard focus and accessible step/status semantics.

The rail is 212 px at normal widths and becomes compact at the minimum viewport. Tool content never depends on horizontal page scrolling.

## Tool flows

### Resize and Minimize

1. **Images** — add files/folders, multi-select, remove, clear, and see an empty light-table state.
2. **Settings** — purpose-built controls, presets, output format, suffix, and compatibility warnings.
3. **Review** — input/output summary, estimated action, destination, and a single primary Run action.
4. **Results** — progress/cancel while active; output list, warnings, size metrics, selection, and Copy Image when complete.

### Sequence Grouper

1. **Images** — build the session input set and select the maximum capture gap.
2. **Analyze** — run offline analysis and explain the signals used.
3. **Review groups** — confidence, evidence, group type, split/merge, exclude, and remove individual images.
4. **Export** — choose destination, export confirmed groups, show progress and manifest result.

### Metadata Cleaner

1. **Images** — build the input set.
2. **Audit** — run ExifTool audit and show per-file metadata coverage.
3. **Safe Share** — select categories, compare tags removed against protected tags, and choose destination.
4. **Results** — clean, re-audit, and show outputs or precise post-audit failures.

### Before/After Packager

1. **Images** — add and organize candidate images.
2. **Pair** — auto-pair, show confidence, reassign by drag/select, and remove pairs.
3. **Package** — alignment, still format, output formats, destination, and export summary.
4. **Results** — progress, completed assets, warnings, and next actions.

## Signature details

- Empty input states resemble an illuminated contact-sheet bay rather than a generic dashed drop box.
- Technical values use small mono stat tiles with real meaning: input count, selected count, target edge/quality, output format, group confidence, and export count.
- Step headers use a restrained tool-colored beam along the top edge; this is the single expressive visual device.
- Primary actions live only in the sticky footer. The content area does not repeat competing Run/Export buttons.
- Results emphasize completed assets and measurable outcomes rather than a success banner alone.

## Component boundaries

- `ToolWorkflowShell`: shared rail, responsive behavior, status, and Back to Toolbox.
- `ToolStepFrame`: fixed header, scrollable body, optional stat strip, and fixed footer.
- `MediaInputStage`: shared input actions, selection controls, file rows, and empty state.
- `ToolResultStage`: progress/cancel, output selection, warnings, and Copy Image.
- Tool-specific option and review panels remain owned by Utility or Advanced workspaces.

These components are presentational. Existing clients, requests, job events, presets, and state remain the authority for behavior.

## Motion and accessibility

- Step changes use one subtle 160–200 ms opacity/translate transition and respect `prefers-reduced-motion`.
- Hover does not move dense controls; selected and active states rely on border, fill, and glyph changes.
- Rail buttons expose `aria-current="step"`; progress remains live-region status.
- Step changes move focus to the new step heading. Returning to Toolbox preserves existing focus restoration.

## Acceptance

- The five redesigned tools visibly belong to the same application as Ingest & Rename.
- All existing tool behaviors and tests remain valid.
- New tests cover step progression, disabled gating, progress/results, Copy Image selection, keyboard focus, and minimum viewport structure.
- Browser QA covers all five workspaces in English and Vietnamese with a clean console.
- Desktop build, lint, typecheck, formatting, and existing Rust/API suites remain green.
