# LightOps Native Workflow Refactor Design

Date: 2026-06-07

## Goal

Refactor the LightOps Tauri app so it behaves like a native desktop utility, feels faster during file operations, and fits core workflows inside the minimum window without requiring users to scroll through every control.

## Scope

This design covers the desktop app in `src/` and `src-tauri/`.

In scope:

- Replace the custom React title bar with fully native OS window chrome.
- Add native Tauri menu/actions for app-level commands.
- Restructure the main UI into a progressive workflow.
- Hide controls that are not needed before run, during run, or after run.
- Reduce frontend render work during scan, rename planning, and execution.

Out of scope:

- Landing page changes under `src-landing/`.
- New file operation features beyond the existing scan, dry run, run, stop, preset, settings, output, and language functions.
- Changing the backend rename semantics.
- Replacing Tauri, React, i18n, or the current design system.

## Current Problems

The current app uses `decorations: false` and renders a custom `TitleBar` with window controls, language toggle, settings, and update state. This duplicates OS behavior and adds DOM/event work to every screen.

The current main UI shows nearly every control at once. A fixed `900px` configuration panel plus the right log panel forces users into a large layout. At the configured minimum height, users can need vertical scrolling to access all functions.

Progress events append log entries one by one through React state. Each event can re-render the log panel and surrounding app. Motion animations on background orbs and log rows add more work while the app is already processing files.

## Native Chrome And Menu

Use fully native OS chrome:

- Set the main window to `decorations: true`.
- Keep a normal native title of `LightOps`.
- Remove `TitleBar` from the React render tree.
- Retain existing app-level settings, language, update, run, dry run, stop, and folder actions through native menu items and in-app controls.

Native menus:

- `File`
  - `Add Source Folder`
  - `Choose Output Folder`
  - `Save Preset`
  - `Settings`
  - `Quit`
- `Run`
  - `Dry Run`
  - `Run`
  - `Stop`
- `View`
  - `Show Results`
  - `Language: English`
  - `Language: Vietnamese`
- `Help`
  - `Check for Updates`

Menu events should flow into the existing frontend action handlers rather than duplicating business logic in Rust. Rust owns native menu construction and emits stable event names. React listens for those events and calls the same handlers used by visible controls.

Disabled menu states are not required for the first pass. The frontend must still guard invalid actions, for example running with no source folders.

## Workflow UI

Use a progressive workflow with a narrow step rail and one active content area:

- `1 Source`
- `2 Rules`
- `3 Review & Run`
- `4 Results`

The app should fit in the current minimum window of `900x640`. The workflow shell itself must not need page-level scrolling at that size. If content overflows inside a panel, only that panel scrolls.

### Step 1: Source

Purpose: collect required file locations.

Visible before source input is complete:

- Source folder picker and selected source folders.
- Output folder picker and current output mode summary.
- Compact next action to continue to Rules.

Hidden before it is useful:

- Log panel.
- Progress bar.
- Preset internals unless opened from menu or a compact preset selector.

Completion condition:

- At least one source folder exists.

### Step 2: Rules

Purpose: configure camera format and rename behavior.

Visible:

- Camera preset.
- RAW extension field.
- File type selection.
- Rename prefix, format, and starting number.
- A compact advanced section.

Advanced section:

- Collapsed by default.
- Contains recursive scan, copy/move, organize by date, only paired, and include video.
- Shows a small summary when collapsed, for example `Copy, no recursive, videos off`.

Completion condition:

- Existing validation rules still apply: source folder is required, and RAW extensions are required when file type is not JPG.

### Step 3: Review & Run

Purpose: show a compact summary and primary actions.

Visible before running:

- Source count and output destination.
- Camera/file type summary.
- Rename pattern preview.
- Advanced summary.
- `Dry Run` and `Run` buttons.
- Move-mode warning when `move` is selected.

Hidden before running:

- Log body.
- Progress log table.

During run:

- Lock editing controls.
- Replace the review body with a processing state.
- Show large progress, current count, ok/skip/error stats, and `Stop`.
- Keep the step rail visible.
- Do not animate background elements during processing.

### Step 4: Results

Purpose: inspect what happened after dry run or actual execution.

Visible after a run starts:

- Final status banner.
- Log/results view with text and table modes.
- Clear results action.
- Option to return to Rules or Source.

The Results step should not appear as primary content before a run exists. It may be shown as disabled or hidden in the step rail until there are entries or processing has started.

## State Model

Use explicit UI mode derived from existing app state:

- `setup`: no run in progress and no meaningful results.
- `processing`: scan, plan, or execute is active.
- `complete`: execution completed.
- `stopped`: execution was cancelled.
- `error`: execution failed.

Use an active step state independent of processing status:

- Users can navigate between Source, Rules, and Review before running.
- Starting dry run or run switches active step to Review/processing.
- Receiving the first result or finishing switches active step to Results.
- Clearing logs returns to Review if inputs remain valid, otherwise Source.

## Performance Design

Frontend performance changes:

- Remove decorative animated gradient orbs from the main app shell, or make them static.
- Remove row-by-row entry animations from log rendering.
- Batch progress/log state updates using a small buffer and periodic flush, targeting roughly 100-200ms.
- Keep the latest log entries visible in React state while preserving the full log in a ref.
- Avoid reconstructing large arrays on every progress event.
- Split the workflow into smaller components so step changes do not rerender every panel.
- Keep handler references stable enough for menu event listeners without overusing memoization.

Rust/backend performance changes:

- Keep scan, plan, and execute commands in Rust.
- Continue emitting progress, but frontend should tolerate high-frequency events.
- Do not change file matching or rename semantics in this refactor.
- Remove or defer deprecated chrono API cleanup only if it is touched by validation warnings.

## Components

Expected frontend structure:

- `App`
  - Owns workflow state, Tauri command calls, menu event listeners, and global app state.
- `WorkflowShell`
  - Renders step rail, status region, and active step content.
- `SourceStep`
  - Wraps existing source and output panels in compact form.
- `RulesStep`
  - Wraps camera, rename, advanced, and preset controls.
- `ReviewRunStep`
  - Shows summary and run actions, or processing state during run.
- `ResultsStep`
  - Hosts progress summary and log/results view.
- Existing panels may be reused but should be made denser where needed.

Expected Tauri structure:

- `src-tauri/src/lib.rs`
  - Configure plugins, invoke handlers, and menu setup.
- Optional `src-tauri/src/menu.rs`
  - Isolate native menu definitions and event constants if `lib.rs` becomes noisy.

## Error Handling

Existing validation stays in the frontend:

- No source folders: show error banner and keep user on Source.
- RAW extensions missing for RAW/Both mode: show error banner and keep user on Rules.
- Scan returns no files: show warning and keep user in Review or Results with a clear message.
- Plan returns no entries: show warning and keep user in Review or Results with a clear message.
- Execute error: switch to Results and show error banner plus log entry.

Menu-triggered actions must use the same validation and error paths as button-triggered actions.

## Accessibility And Desktop Behavior

- Native title bar handles OS-specific window controls.
- Step rail buttons need accessible names and current-step indication.
- Menu items need predictable keyboard accelerators where supported:
  - Add source: `CmdOrCtrl+O`
  - Dry run: `CmdOrCtrl+Shift+Enter`
  - Run: `CmdOrCtrl+Enter`
  - Stop: `Esc`
  - Settings: `CmdOrCtrl+,`
- Inputs remain text-selectable.
- Logs remain selectable/copyable where possible.

## Testing

Validation commands:

- `pnpm build:frontend`
- `pnpm lint`
- `cd src-tauri && cargo check`

Manual verification:

- Launch with `pnpm dev`.
- Confirm native OS title bar appears and custom title bar is gone.
- Confirm native menu items trigger the same app actions as visible controls.
- Confirm the app is usable at `900x640` without page-level scrolling.
- Confirm Source, Rules, Review, Processing, and Results states transition correctly.
- Confirm dry run and run progress do not make the UI sluggish with many events.
- Confirm stop cancels execution and moves to Results/stopped state.

## Implementation Order

1. Add native menu setup and enable native decorations.
2. Remove custom title bar usage from React.
3. Introduce workflow shell and step components using existing panels.
4. Add progressive visibility rules for setup, processing, and results.
5. Optimize log/progress buffering and remove high-cost animations.
6. Validate frontend build, lint, and Rust check.
7. Run manual desktop verification.

## Risks

- Native menu API details can differ slightly across Tauri v2 platforms, so menu construction should be kept small and easy to adjust.
- If native menu events are not available in a target environment, visible in-app controls must remain sufficient for all critical actions.
- Log virtualization may be unnecessary initially; batching and removing animation should be tried first because it is lower risk.
- The worktree already has unrelated modifications. Implementation should only stage and commit files intentionally touched for this refactor.
