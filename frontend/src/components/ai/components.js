import { defineComponent, createLibrary } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import DashboardRoot from './Dashboard.ai.jsx';
import ProjectCardAI from './ProjectCard.ai.jsx';
import BurndownChartAI from './BurndownChart.ai.jsx';
import StatusBadge from './StatusBadge.jsx';

const DashboardDef = defineComponent({
  name: 'Dashboard',
  description: 'Root layout container — renders all child components in a vertical column.',
  props: z.object({
    children: z.array(z.any()).optional().describe('Child components to render'),
  }),
  component: DashboardRoot,
});

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
  root: 'Dashboard',
  components: [DashboardDef, ProjectCardDef, BurndownChartDef, StatusBadgeDef],
});
