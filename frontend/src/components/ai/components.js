import { defineComponent, createLibrary } from '@openuidev/react-lang';
import { z } from 'zod';
import ProjectCardAI from './ProjectCard.ai.jsx';
import BurndownChartAI from './BurndownChart.ai.jsx';
import StatusBadge from './StatusBadge.jsx';

const ProjectCardDef = defineComponent({
  name: 'ProjectCard',
  description: 'Displays a project summary card with name, budget, hours logged, and remaining hours.',
  props: z.object({
    projectId: z.coerce.number().int().positive().describe('InvoiceNinja project ID'),
  }),
  component: ProjectCardAI,
});

const BurndownChartDef = defineComponent({
  name: 'BurndownChart',
  description: 'Renders the ideal vs actual burndown line chart for a project.',
  props: z.object({
    projectId: z.coerce.number().int().positive().describe('InvoiceNinja project ID'),
  }),
  component: BurndownChartAI,
});

const StatusBadgeDef = defineComponent({
  name: 'StatusBadge',
  description: 'Shows the budget health status of a project as a coloured badge.',
  props: z.object({
    status: z.enum(['on-budget', 'at-risk', 'over-budget']).describe('Budget health status'),
  }),
  component: StatusBadge,
});

export const library = createLibrary({
  components: [ProjectCardDef, BurndownChartDef, StatusBadgeDef],
});
