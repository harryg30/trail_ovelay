// Difficulty display labels (ski-area symbols)
export const DIFFICULTY_LABELS: Record<string, string> = {
  easy:         '● Green Circle',
  intermediate: '■ Blue Square',
  hard:         '◆ Black Diamond',
  pro:          '◆◆ Double Black Diamond',
};

// Badge variant for each difficulty level
export const DIFFICULTY_BADGE_VARIANT: Record<string, string> = {
  easy:         'trail',
  intermediate: 'catalog',
  hard:         'ink',
  pro:          'default',
};

// Direction display labels
export const DIRECTION_LABELS: Record<string, string> = {
  'one-way':      'One-way',
  'out-and-back': 'Out & back',
  'loop':         'Loop',
};

// Valid digitization task kinds (mirrors DB CHECK constraint)
export const DIGITIZATION_TASK_KINDS = [
  'named_route',
  'intersection_route',
  'loop',
  'other',
] as const;
export type DigitizationTaskKind = (typeof DIGITIZATION_TASK_KINDS)[number];
