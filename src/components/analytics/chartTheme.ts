/**
 * Chart colours that follow the light / dark theme. They are CSS custom properties
 * (defined in globals.css), so charts restyle without re-rendering when the theme changes.
 */
export const CHART_GRID = 'var(--chart-grid)';
export const CHART_AXIS = 'var(--chart-axis)';
export const CHART_TOOLTIP_STYLE = {
  background: 'var(--tooltip-bg)',
  border: '1px solid var(--tooltip-border)',
  color: 'var(--text-primary)',
} as const;
