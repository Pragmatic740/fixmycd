export const CATEGORIES: Record<string, string[]> = {
  Road: ['Pothole', 'Crumbling Surface', 'Missing Sign', 'Blocked Drain'],
  Traffic: ['Broken Light', 'Damaged Signal', 'Missing Stop Sign', 'Faded Markings'],
  Water: ['Burst Main', 'Leak', 'Low Pressure', 'Contamination'],
  Utilities: ['Power Outage', 'Downed Line', 'Broken Pole', 'Gas Leak'],
  Buildings: ['Abandoned Factory', 'Structural Damage', 'Graffiti', 'Broken Window'],
  Parks: ['Fallen Tree', 'Broken Equipment', 'Overgrown Area', 'Damaged Path'],
  Schools: ['Roof Damage', 'Broken HVAC', 'Safety Hazard', 'Accessibility Issue'],
};

export const POST_ACTIONS = ['failure', 'fix', 'update'] as const;
export const POST_TYPES = ['new', 'update'] as const;

export const REPORT_STATUSES = [
  'submitted',
  'in_review',
  'accepted',
  'resubmit',
  'duplicate',
  'in_progress',
  'resolved',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];
