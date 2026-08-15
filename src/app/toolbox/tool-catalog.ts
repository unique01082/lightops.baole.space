import {
  Aperture,
  ArrowLeftRight,
  Eraser,
  Images,
  Minimize2,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';

export type ToolId =
  | 'ingest_rename'
  | 'resize'
  | 'minimize'
  | 'sequence_grouper'
  | 'metadata_cleaner'
  | 'before_after';

export type ToolDefinition = {
  id: ToolId;
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  accent: string;
};

export const TOOL_CATALOG: readonly ToolDefinition[] = [
  {
    id: 'ingest_rename',
    titleKey: 'toolbox.tools.ingestRename.title',
    descriptionKey: 'toolbox.tools.ingestRename.description',
    icon: Aperture,
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'resize',
    titleKey: 'toolbox.tools.resize.title',
    descriptionKey: 'toolbox.tools.resize.description',
    icon: ScanLine,
    accent: 'from-sky-500 to-cyan-400',
  },
  {
    id: 'minimize',
    titleKey: 'toolbox.tools.minimize.title',
    descriptionKey: 'toolbox.tools.minimize.description',
    icon: Minimize2,
    accent: 'from-emerald-500 to-teal-400',
  },
  {
    id: 'sequence_grouper',
    titleKey: 'toolbox.tools.sequenceGrouper.title',
    descriptionKey: 'toolbox.tools.sequenceGrouper.description',
    icon: Images,
    accent: 'from-amber-500 to-orange-400',
  },
  {
    id: 'metadata_cleaner',
    titleKey: 'toolbox.tools.metadataCleaner.title',
    descriptionKey: 'toolbox.tools.metadataCleaner.description',
    icon: Eraser,
    accent: 'from-rose-500 to-pink-400',
  },
  {
    id: 'before_after',
    titleKey: 'toolbox.tools.beforeAfter.title',
    descriptionKey: 'toolbox.tools.beforeAfter.description',
    icon: ArrowLeftRight,
    accent: 'from-indigo-500 to-violet-400',
  },
];

export function getToolDefinition(toolId: ToolId): ToolDefinition {
  const tool = TOOL_CATALOG.find((candidate) => candidate.id === toolId);
  if (!tool) throw new Error(`Unknown LightOps tool: ${toolId}`);
  return tool;
}
