import { createContext } from 'react';

export const AIDashboardContext = createContext({
  projects: [],
  theme: { barFill: '#117cc1', barStroke: '#0a3f60' },
});
