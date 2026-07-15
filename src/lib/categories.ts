export const INFRASTRUCTURE_TAXONOMY: Record<string, string[]> = {
  Transportation: ['Road', 'Bridge', 'Traffic Signal', 'Sidewalk', 'Transit Stop', 'Parking'],
  'Water/Wastewater': ['Water Main', 'Sewer', 'Storm Drain', 'Treatment Plant', 'Hydrant'],
  Power: ['Transmission Line', 'Distribution Line', 'Substation', 'Streetlight', 'Transformer'],
  'Telecom/Broadband': ['Fiber', 'Cell Tower', 'Public Wi‑Fi', 'Cable Plant'],
  Buildings: ['Public Building', 'Abandoned Structure', 'Housing', 'Commercial'],
  Schools: ['K-12 Facility', 'Campus Infrastructure', 'Playground', 'Accessibility'],
  Health: ['Clinic', 'Hospital Access', 'EMS Facility'],
  Parks: ['Park Path', 'Play Equipment', 'Green Space', 'Tree Hazard'],
  Waste: ['Collection Point', 'Illegal Dumping', 'Recycling'],
  'Flood/Stormwater': ['Flooding', 'Culvert', 'Retention Basin', 'Levee'],
  'Public Safety': ['Signage', 'Barrier', 'Hazard Marker', 'Emergency Access'],
};

/** Legacy category → infrastructure class mapping for older reports */
export const LEGACY_CATEGORY_MAP: Record<string, { infrastructureClass: string; infrastructureType?: string }> = {
  Road: { infrastructureClass: 'Transportation', infrastructureType: 'Road' },
  Traffic: { infrastructureClass: 'Transportation', infrastructureType: 'Traffic Signal' },
  Water: { infrastructureClass: 'Water/Wastewater', infrastructureType: 'Water Main' },
  Utilities: { infrastructureClass: 'Power', infrastructureType: 'Distribution Line' },
  Buildings: { infrastructureClass: 'Buildings', infrastructureType: 'Abandoned Structure' },
  Parks: { infrastructureClass: 'Parks', infrastructureType: 'Park Path' },
  Schools: { infrastructureClass: 'Schools', infrastructureType: 'K-12 Facility' },
};

/** Keep CATEGORIES for backward-compatible feed filters */
export const CATEGORIES: Record<string, string[]> = {
  ...Object.fromEntries(
    Object.entries(INFRASTRUCTURE_TAXONOMY).map(([klass, types]) => [klass, types])
  ),
  // Legacy keys still appear in older seed/report data
  Road: ['Pothole', 'Crumbling Surface', 'Missing Sign', 'Blocked Drain'],
  Traffic: ['Broken Light', 'Damaged Signal', 'Missing Stop Sign', 'Faded Markings'],
  Water: ['Burst Main', 'Leak', 'Low Pressure', 'Contamination'],
  Utilities: ['Power Outage', 'Downed Line', 'Broken Pole', 'Gas Leak'],
};

export const FAILURE_TYPES = [
  'Structural Failure',
  'Surface Damage',
  'Outage',
  'Blockage',
  'Leak/Burst',
  'Missing Asset',
  'Safety Hazard',
  'Accessibility Barrier',
  'Contamination',
  'Flooding',
  'Vandalism',
  'Deferred Maintenance',
  'Other',
] as const;

export const EVIDENCE_TYPES = ['photo', 'video', 'audio', 'eyewitness', 'sensor', 'official'] as const;

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

export const GEOGRAPHIC_AREA_TYPES = [
  'nation',
  'census_region',
  'census_division',
  'state',
  'county',
  'city',
  'zip',
  'census_tract',
  'congressional_district',
  'state_senate_district',
  'state_house_district',
  'council_district',
  'school_district',
  'utility_area',
  'custom_region',
] as const;

export const SERVICE_AREA_TYPES = [
  'water',
  'power',
  'telecom',
  'school',
  'emergency',
  'transit',
  'waste',
  'other',
] as const;

export const DATE_PRESETS = [
  'day',
  'week',
  'month',
  'quarter',
  'ytd',
  'year',
  'custom',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type FailureType = (typeof FAILURE_TYPES)[number];
export type DatePreset = (typeof DATE_PRESETS)[number];

export function resolveInfrastructure(
  category?: string | null,
  subcategory?: string | null,
  infrastructureClass?: string | null,
  infrastructureType?: string | null
) {
  if (infrastructureClass) {
    return {
      infrastructureClass,
      infrastructureType: infrastructureType || subcategory || null,
      category: infrastructureClass,
      subcategory: infrastructureType || subcategory || null,
    };
  }

  if (category && LEGACY_CATEGORY_MAP[category]) {
    const mapped = LEGACY_CATEGORY_MAP[category];
    return {
      infrastructureClass: mapped.infrastructureClass,
      infrastructureType: mapped.infrastructureType || subcategory || null,
      category,
      subcategory: subcategory || null,
    };
  }

  return {
    infrastructureClass: category || null,
    infrastructureType: subcategory || null,
    category: category || null,
    subcategory: subcategory || null,
  };
}
