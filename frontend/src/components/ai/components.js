import { defineComponent, createLibrary } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import DashboardRoot from './Dashboard.ai.jsx';
import ProjectCardAI from './ProjectCard.ai.jsx';
import BurndownChartAI from './BurndownChart.ai.jsx';
import StatusBadge from './StatusBadge.jsx';
import ProjectTurnoverAI from './ProjectTurnover.ai.jsx';
import TurnoverOverviewAI from './TurnoverOverview.ai.jsx';
import TimesheetSummaryAI from './TimesheetSummary.ai.jsx';

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

const ProjectTurnoverDef = defineComponent({
  name: 'ProjectTurnover',
  description: 'Turnover per year (invoiced, paid, open) for one project.',
  props: z.object({
    projectId: z.coerce.number().int().positive().describe('InvoiceNinja project ID'),
  }),
  component: ProjectTurnoverAI,
});

const TurnoverOverviewDef = defineComponent({
  name: 'TurnoverOverview',
  description: 'Cross-project turnover (invoiced, paid, open) for one year; omit year for the current year.',
  props: z.object({
    year: z.coerce.number().int().optional().describe('Calendar year, e.g. 2026; omit for current year'),
  }),
  component: TurnoverOverviewAI,
});

const TimesheetSummaryDef = defineComponent({
  name: 'TimesheetSummary',
  description: 'Month total of booked hours with hour rate and EUR for one project; omit month for the current month.',
  props: z.object({
    projectId: z.coerce.number().int().positive().describe('InvoiceNinja project ID'),
    month:     z.string().optional().describe('Month YYYY-MM; omit for current month'),
  }),
  component: TimesheetSummaryAI,
});

export const library = createLibrary({
  root: 'Dashboard',
  components: [DashboardDef, ProjectCardDef, BurndownChartDef, StatusBadgeDef, ProjectTurnoverDef, TurnoverOverviewDef, TimesheetSummaryDef],
});
