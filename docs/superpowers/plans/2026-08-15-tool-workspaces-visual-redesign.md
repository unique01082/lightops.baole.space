# LightOps Tool Workspaces Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Resize, Minimize, Sequence Grouper, Metadata Cleaner, and Before/After Packager feel as considered and coherent as Ingest & Rename while preserving all processing behavior.

**Architecture:** Introduce a presentational workflow shell, step frame, media-input stage, and results stage shared by the five tools. Utility and Advanced workspaces retain ownership of requests, clients, presets, and tool-specific state; they expose that state through purpose-built four-step flows.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 4, Lucide React, react-i18next, Vitest, Testing Library, Tauri 2.

## Global Constraints

- Preserve all existing processing requests, clients, events, presets, and backend contracts.
- No page-level scrolling at 900×640 or 1200×780; only workspace panels scroll.
- Space Grotesk remains the heading face, Inter the body face, and JetBrains Mono the technical-value face.
- Tool accents are cyan, emerald, amber, rose, and indigo respectively; accents identify state and never recolor the whole workspace.
- Primary Run/Export actions appear once, in the fixed step footer.
- All steps have accessible names; active steps use `aria-current="step"`; progress uses a live region.
- Motion is 160–200 ms and disabled by `prefers-reduced-motion`.

---

### Task 1: Shared workflow shell and step frame

**Files:**

- Create: `src/app/tools/tool-workflow-shell.tsx`
- Create: `src/app/tools/tool-workflow-shell.test.tsx`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/vi.json`

**Interfaces:**

- Consumes: `ToolId`, `getToolDefinition()` from `src/app/toolbox/tool-catalog.ts`.
- Produces: `ToolWorkflowStep`, `ToolWorkflowShell`, `ToolStepFrame`, and `ToolStat`.

- [ ] **Step 1: Write the failing shell test**

```tsx
render(
  <ToolWorkflowShell
    toolId="resize"
    steps={[
      { id: 'images', label: 'Images', description: 'Choose files', complete: true },
      { id: 'settings', label: 'Settings', description: 'Set dimensions' },
    ]}
    activeStep="settings"
    statusLabel="Ready"
    onBack={onBack}
    onStepChange={onStepChange}
  >
    <div>Workspace content</div>
  </ToolWorkflowShell>,
);
expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'step');
expect(screen.getByText('Workspace content')).toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test src/app/tools/tool-workflow-shell.test.tsx`

Expected: FAIL because `tool-workflow-shell.tsx` does not exist.

- [ ] **Step 3: Implement the shared contracts and shell**

```ts
export type ToolWorkflowStep = {
  id: string;
  label: string;
  description: string;
  complete?: boolean;
  disabled?: boolean;
};

export type ToolStat = { label: string; value: string; tone?: 'default' | 'accent' | 'warning' };
```

`ToolWorkflowShell` renders the Ingest-style background, a 212 px workflow rail, Back to Toolbox, tool glyph/title, numbered/completed step buttons, status card, and the bordered main surface. `ToolStepFrame` renders a fixed eyebrow/title/description header, optional `ToolStat[]`, an internally scrolling body, and a fixed footer. Use the catalog gradient to derive the glyph treatment and a `data-tool` attribute for accent CSS.

- [ ] **Step 4: Run the shell test and verify GREEN**

Run: `pnpm test src/app/tools/tool-workflow-shell.test.tsx`

Expected: PASS with active-step, Back, disabled-step, and content assertions.

- [ ] **Step 5: Commit the independently testable shell**

```bash
git add src/app/tools/tool-workflow-shell.tsx src/app/tools/tool-workflow-shell.test.tsx src/i18n/en.json src/i18n/vi.json
git commit -m "feat: add shared tool workflow shell"
```

### Task 2: Contact-sheet media input and result stages

**Files:**

- Create: `src/app/tools/media-input-stage.tsx`
- Create: `src/app/tools/media-input-stage.test.tsx`
- Create: `src/app/tools/tool-result-stage.tsx`
- Create: `src/app/tools/tool-result-stage.test.tsx`

**Interfaces:**

- Produces:

```ts
type MediaInputStageProps = {
  paths: string[];
  selectedPaths: Set<string>;
  onSelectedPathsChange: (paths: Set<string>) => void;
  onAddImages: () => void;
  onAddFolder: () => void;
  onRemove: (paths: Set<string>) => void;
  draggable?: boolean;
  onDragPath?: (event: React.DragEvent, path: string) => void;
};

type ToolResultStageProps = {
  progress: JobProgress | null;
  activeJobId: string | null;
  outputs: OutputAsset[];
  warnings: string[];
  error?: string | null;
  selectedOutputs: Set<string>;
  onToggleOutput: (path: string) => void;
  onCancel: () => void;
  onCopy?: (path: string) => void;
};
```

- [ ] **Step 1: Write failing interaction tests**

Test that the input stage shows a contact-sheet empty state, supports checkbox multi-select/remove/clear, and exposes Add images/Add folder names. Test that the result stage announces progress, enables Copy Image for exactly one selected output, renders per-file warnings, and renders a retry-oriented error panel.

- [ ] **Step 2: Run both tests and verify RED**

Run: `pnpm test src/app/tools/media-input-stage.test.tsx src/app/tools/tool-result-stage.test.tsx`

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement the two stages**

Use an illuminated empty bay with four subtle frame cells, mono file paths, selection count, and compact file rows. Keep controls semantic HTML. The result stage uses a metric strip, a live progress block while running, and completed output rows with size/dimensions after completion.

- [ ] **Step 4: Run both tests and verify GREEN**

Run: `pnpm test src/app/tools/media-input-stage.test.tsx src/app/tools/tool-result-stage.test.tsx`

Expected: PASS with no accessibility warnings.

- [ ] **Step 5: Commit the shared stages**

```bash
git add src/app/tools/media-input-stage.tsx src/app/tools/media-input-stage.test.tsx src/app/tools/tool-result-stage.tsx src/app/tools/tool-result-stage.test.tsx
git commit -m "feat: add media input and result stages"
```

### Task 3: Resize and Minimize guided workflows

**Files:**

- Modify: `src/app/tools/utility-workspace.tsx`
- Modify: `src/app/tools/utility-workspace.test.tsx`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/vi.json`

**Interfaces:**

- Consumes: `ToolWorkflowShell`, `ToolStepFrame`, `MediaInputStage`, and `ToolResultStage` from Tasks 1–2.
- Preserves: `MediaClient`, `ToolJobRequest`, `ResizeOptions`, and `MinimizeOptions` exactly.

- [ ] **Step 1: Add failing workflow tests**

Add tests that assert Images → Settings → Review → Results progression; Settings is disabled before inputs; Review is disabled before an output directory; Run sends the existing request unchanged; job start immediately activates Results; and result Copy Image still requires exactly one selected output.

- [ ] **Step 2: Run the utility test and verify RED**

Run: `pnpm test src/app/tools/utility-workspace.test.tsx`

Expected: FAIL because step buttons and review summary do not exist.

- [ ] **Step 3: Refactor UtilityWorkspace into four stages**

Keep all state and handlers. Replace the two-column JSX with:

```tsx
<ToolWorkflowShell
  toolId={toolId}
  steps={steps}
  activeStep={activeStep}
  statusLabel={statusLabel}
  onBack={onBack}
  onStepChange={setActiveStep}
>
  {activeStep === 'images' && (
    <ToolStepFrame
      eyebrow={imagesEyebrow}
      title={imagesTitle}
      description={imagesDescription}
      stats={stats}
      footer={imagesFooter}
    >
      <MediaInputStage
        paths={inputs}
        selectedPaths={selectedInputs}
        onSelectedPathsChange={setSelectedInputs}
        onAddImages={addImages}
        onAddFolder={addFolder}
        onRemove={removeInputs}
      />
    </ToolStepFrame>
  )}
  {activeStep === 'settings' && (
    <ToolStepFrame
      eyebrow={settingsEyebrow}
      title={settingsTitle}
      description={settingsDescription}
      stats={stats}
      footer={settingsFooter}
    >
      {optionsPanel}
    </ToolStepFrame>
  )}
  {activeStep === 'review' && (
    <ToolStepFrame
      eyebrow={reviewEyebrow}
      title={reviewTitle}
      description={reviewDescription}
      stats={stats}
      footer={reviewFooter}
    >
      {reviewCards}
    </ToolStepFrame>
  )}
  {activeStep === 'results' && (
    <ToolStepFrame
      eyebrow={resultsEyebrow}
      title={resultsTitle}
      description={resultsDescription}
      stats={stats}
      footer={resultsFooter}
    >
      <ToolResultStage
        progress={progress}
        activeJobId={runningJobId}
        outputs={result?.outputs ?? []}
        warnings={result?.warnings ?? []}
        error={error}
        selectedOutputs={selected}
        onToggleOutput={toggleOutput}
        onCancel={cancel}
        onCopy={copyOutput}
      />
    </ToolStepFrame>
  )}
</ToolWorkflowShell>
```

Use cyan stats for Resize and emerald stats for Minimize. On Run, set `activeStep` to `results` before awaiting `client.runJob`; preserve `recordRecentJob` behavior.

- [ ] **Step 4: Run utility tests and verify GREEN**

Run: `pnpm test src/app/tools/utility-workspace.test.tsx`

Expected: all existing and new utility tests pass.

- [ ] **Step 5: Commit the utility redesign**

```bash
git add src/app/tools/utility-workspace.tsx src/app/tools/utility-workspace.test.tsx src/i18n/en.json src/i18n/vi.json
git commit -m "feat: redesign resize and minimize workflows"
```

### Task 4: Advanced tool guided workflows

**Files:**

- Modify: `src/app/tools/advanced-workspace.tsx`
- Modify: `src/app/tools/advanced-workspace.test.tsx`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/vi.json`

**Interfaces:**

- Consumes the shared components from Tasks 1–2.
- Preserves every method on `AdvancedClient` and all request payloads.

- [ ] **Step 1: Add failing per-tool flow tests**

Sequence test: Images → Analyze → Review groups → Export, with export disabled until reviewed groups and destination exist.

Metadata test: Images → Audit → Safe Share → Results, with the existing Safe Share categories selected and exact protected/removed tags visible.

Before/After test: Images → Pair → Package → Results, with existing drag reassignment, alignment values, formats, and export payload preserved.

- [ ] **Step 2: Run advanced tests and verify RED**

Run: `pnpm test src/app/tools/advanced-workspace.test.tsx`

Expected: FAIL because the stage labels, rail, and gated footers do not exist.

- [ ] **Step 3: Introduce a typed step configuration**

```ts
type AdvancedStep =
  | 'images'
  | 'analyze'
  | 'review'
  | 'export'
  | 'audit'
  | 'safe_share'
  | 'pair'
  | 'package'
  | 'results';

const flowByTool = {
  sequence_grouper: ['images', 'analyze', 'review', 'export'],
  metadata_cleaner: ['images', 'audit', 'safe_share', 'results'],
  before_after: ['images', 'pair', 'package', 'results'],
} as const;
```

Use tool-specific labels/descriptions from i18n while reusing the same shell. Move Analyze/Audit/Pair and Export/Clean/Package actions into the matching fixed footer. Keep group cards, metadata audit lists, and pairing cards intact but restyle them into technical light-table panels.

- [ ] **Step 4: Run advanced tests and verify GREEN**

Run: `pnpm test src/app/tools/advanced-workspace.test.tsx`

Expected: all existing behaviors and new navigation assertions pass.

- [ ] **Step 5: Commit the advanced redesign**

```bash
git add src/app/tools/advanced-workspace.tsx src/app/tools/advanced-workspace.test.tsx src/i18n/en.json src/i18n/vi.json
git commit -m "feat: redesign advanced photographer workflows"
```

### Task 5: Motion, responsive QA, and preview installation

**Files:**

- Modify: `src/styles/index.css`
- Modify: `src/app/tools/tool-workflow-shell.test.tsx`

**Interfaces:**

- Consumes the rendered structures from Tasks 1–4.
- Produces no new application interface.

- [ ] **Step 1: Add a failing responsive-structure test**

Assert the shell has `overflow-hidden`, the main body has an internal scrolling region, the footer is `shrink-0`, and the rail exposes the compact breakpoint classes used at 900 px.

- [ ] **Step 2: Run the shell test and verify RED**

Run: `pnpm test src/app/tools/tool-workflow-shell.test.tsx`

Expected: FAIL on the missing responsive and motion hooks.

- [ ] **Step 3: Add restrained motion and reduced-motion behavior**

Add a `tool-step-enter` animation of 180 ms using opacity and `translateY(4px)`. Disable it inside `@media (prefers-reduced-motion: reduce)`. Add only the responsive utilities required for the 212 px/compact rail transition; do not introduce a second CSS token system.

- [ ] **Step 4: Run complete automated verification**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm pretty:check
pnpm build:frontend
```

Expected: every command exits 0 with no warnings or failed tests.

- [ ] **Step 5: Run browser QA**

Open each of the five tools at 900×640 and 1200×780. Verify step navigation, disabled gates, focus, English/Vietnamese labels, no page-level scroll, and a clean console. Capture screenshots of Resize settings, Sequence review, Metadata Safe Share, and Before/After package.

- [ ] **Step 6: Build and install the refreshed preview**

Run:

```bash
pnpm tauri build --debug --target universal-apple-darwin --bundles app
codesign --force --deep --sign - src-tauri/target/universal-apple-darwin/debug/bundle/macos/LightOps.app
```

Back up the currently installed preview, copy the new bundle to `/Applications/LightOps.app`, launch it, and verify the native accessibility tree exposes the five guided workspaces.

- [ ] **Step 7: Commit motion and QA coverage**

```bash
git add src/styles/index.css src/app/tools/tool-workflow-shell.test.tsx
git commit -m "test: verify responsive tool workspaces"
```
