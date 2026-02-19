/**
 * Cron Explain Tool
 * Parse cron expressions to natural language and vice versa
 */

export interface CronResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

const FIELD_NAMES = ["minute", "hour", "day of month", "month", "day of week"];

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

// Explain a single cron field
function explainField(field: string, fieldIndex: number): string {
  if (field === "*") return `every ${FIELD_NAMES[fieldIndex]}`;

  // Step: */5
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2));
    return `every ${step} ${FIELD_NAMES[fieldIndex]}s`;
  }

  // Range: 1-5
  if (field.includes("-") && !field.includes(",")) {
    const [start, end] = field.split("-");
    if (fieldIndex === 4) return `${DAY_NAMES[+start]} through ${DAY_NAMES[+end]}`;
    if (fieldIndex === 3) return `${MONTH_NAMES[+start]} through ${MONTH_NAMES[+end]}`;
    return `${FIELD_NAMES[fieldIndex]} ${start} through ${end}`;
  }

  // List: 1,3,5
  if (field.includes(",")) {
    const values = field.split(",");
    if (fieldIndex === 4) return `on ${values.map((v) => DAY_NAMES[+v]).join(", ")}`;
    if (fieldIndex === 3) return `in ${values.map((v) => MONTH_NAMES[+v]).join(", ")}`;
    return `at ${FIELD_NAMES[fieldIndex]} ${values.join(", ")}`;
  }

  // Specific value
  const val = parseInt(field);
  if (fieldIndex === 4) return `on ${DAY_NAMES[val]}`;
  if (fieldIndex === 3) return `in ${MONTH_NAMES[val]}`;
  return `at ${FIELD_NAMES[fieldIndex]} ${val}`;
}

// Explain a full cron expression
export function explainCron(expression: string): string {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return `Invalid cron expression: expected 5 fields, got ${fields.length}`;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

  // Common patterns
  if (expression === "* * * * *") return "Every minute";
  if (expression === "0 * * * *") return "Every hour, at minute 0";
  if (expression === "0 0 * * *") return "Every day at midnight (00:00)";
  if (expression === "0 0 * * 0") return "Every Sunday at midnight";
  if (expression === "0 0 1 * *") return "At midnight on the 1st of every month";
  if (expression === "0 0 1 1 *") return "At midnight on January 1st (yearly)";

  const parts: string[] = [];

  if (minute !== "*") parts.push(explainField(minute, 0));
  if (hour !== "*") parts.push(explainField(hour, 1));
  if (dayOfMonth !== "*") parts.push(explainField(dayOfMonth, 2));
  if (month !== "*") parts.push(explainField(month, 3));
  if (dayOfWeek !== "*") parts.push(explainField(dayOfWeek, 4));

  if (parts.length === 0) return "Every minute";
  return parts.join(", ");
}

// Get next N occurrences of a cron expression
export function getNextRuns(expression: string, count: number = 5, fromDate?: Date): Date[] {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return [];

  const [minField, hourField, domField, monthField, dowField] = fields;
  const runs: Date[] = [];
  const start = fromDate ? new Date(fromDate) : new Date();
  const current = new Date(start);
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);

  const maxIterations = 525960; // ~1 year of minutes

  for (let i = 0; i < maxIterations && runs.length < count; i++) {
    if (
      matchField(current.getMinutes(), minField) &&
      matchField(current.getHours(), hourField) &&
      matchField(current.getDate(), domField) &&
      matchField(current.getMonth() + 1, monthField) &&
      matchField(current.getDay(), dowField)
    ) {
      runs.push(new Date(current));
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  return runs;
}

// Check if a value matches a cron field
function matchField(value: number, field: string): boolean {
  if (field === "*") return true;

  // Step
  if (field.startsWith("*/")) {
    return value % parseInt(field.slice(2)) === 0;
  }

  // List
  if (field.includes(",")) {
    return field.split(",").map(Number).includes(value);
  }

  // Range
  if (field.includes("-")) {
    const [start, end] = field.split("-").map(Number);
    return value >= start && value <= end;
  }

  return value === parseInt(field);
}

// Validate a cron expression
export function validateCron(expression: string): { valid: boolean; error?: string } {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return { valid: false, error: `Expected 5 fields, got ${fields.length}` };
  }

  const ranges = [
    { min: 0, max: 59, name: "minute" },
    { min: 0, max: 23, name: "hour" },
    { min: 1, max: 31, name: "day of month" },
    { min: 1, max: 12, name: "month" },
    { min: 0, max: 7, name: "day of week" },
  ];

  for (let i = 0; i < 5; i++) {
    const field = fields[i];
    if (field === "*") continue;
    if (/^(\*\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*)$/.test(field)) continue;
    return { valid: false, error: `Invalid ${ranges[i].name} field: ${field}` };
  }

  return { valid: true };
}

// Main entry point
export async function cronTool(
  action: string,
  expression: string,
  options?: Record<string, unknown>
): Promise<CronResult> {
  try {
    switch (action) {
      case "explain":
        return { success: true, result: explainCron(expression) };
      case "validate":
        return { success: true, result: validateCron(expression) };
      case "next":
        return { success: true, result: getNextRuns(expression, (options?.count as number) || 5) };
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default { cronTool, explainCron, getNextRuns, validateCron };
