/**
 * Data Analyst - Dataset profiling, insights, anomaly detection
 *
 * Analyzes tabular data (CSV, JSON arrays, or inline data) and returns
 * statistics, column profiles, and detected anomalies.
 */

export interface ColumnProfile {
  name: string;
  type: "number" | "string" | "date" | "boolean" | "mixed";
  count: number;
  nullCount: number;
  uniqueCount: number;
  // Number stats
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  // String stats
  minLength?: number;
  maxLength?: number;
  avgLength?: number;
  // Top values
  topValues: Array<{ value: string; count: number }>;
  anomalies: string[];
}

export interface DataProfile {
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  insights: string[];
  anomalies: string[];
  summary: string;
}

function detectType(values: unknown[]): "number" | "string" | "date" | "boolean" | "mixed" {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNull.length === 0) return "string";

  let nums = 0, strs = 0, bools = 0, dates = 0;
  for (const v of nonNull) {
    if (typeof v === "boolean" || v === "true" || v === "false") bools++;
    else if (typeof v === "number" || (!isNaN(Number(v)) && v !== "")) nums++;
    else if (typeof v === "string" && !isNaN(Date.parse(v)) && v.length > 6) dates++;
    else strs++;
  }

  const total = nonNull.length;
  if (nums / total > 0.8) return "number";
  if (bools / total > 0.8) return "boolean";
  if (dates / total > 0.8) return "date";
  if (strs / total > 0.5) return "string";
  return "mixed";
}

function computeNumericStats(values: number[]): {
  min: number; max: number; mean: number; median: number; stdDev: number;
} {
  if (values.length === 0) return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = values.reduce((s, v) => s + v, 0);
  const mean = sum / values.length;
  const median =
    values.length % 2 === 0
      ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
      : sorted[Math.floor(values.length / 2)];
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, mean: Math.round(mean * 100) / 100, median, stdDev: Math.round(stdDev * 100) / 100 };
}

function getTopValues(values: unknown[], limit: number = 5): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = String(v ?? "null");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function detectAnomalies(values: number[], colName: string): string[] {
  if (values.length < 4) return [];
  const anomalies: string[] = [];

  const { mean, stdDev } = computeNumericStats(values);
  if (stdDev === 0) return [];

  // Z-score outliers (> 3 std deviations)
  const outliers = values.filter((v) => Math.abs(v - mean) > 3 * stdDev);
  if (outliers.length > 0) {
    anomalies.push(
      `${colName}: ${outliers.length} outlier(s) detected (> 3σ from mean). Values: ${outliers.slice(0, 5).join(", ")}`
    );
  }

  // Check for negative values in potentially non-negative columns
  if (mean > 0 && values.some((v) => v < 0)) {
    const negCount = values.filter((v) => v < 0).length;
    anomalies.push(`${colName}: ${negCount} negative value(s) in a mostly positive column`);
  }

  return anomalies;
}

/**
 * Parse CSV string into array of objects
 */
export function parseCSV(csv: string): Record<string, unknown>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  // Simple CSV parser (handles quoted fields)
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]);
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const val = values[j] ?? "";
      // Auto-convert numbers
      if (val !== "" && !isNaN(Number(val))) {
        row[headers[j]] = Number(val);
      } else {
        row[headers[j]] = val;
      }
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Profile a dataset and return statistics, insights, and anomalies
 */
export function profileData(data: Record<string, unknown>[]): DataProfile {
  if (data.length === 0) {
    return {
      rowCount: 0,
      columnCount: 0,
      columns: [],
      insights: ["Dataset is empty."],
      anomalies: [],
      summary: "Empty dataset — no data to analyze.",
    };
  }

  // Get all column names
  const colNames = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) colNames.add(key);
  }

  const columns: ColumnProfile[] = [];
  const allAnomalies: string[] = [];
  const insights: string[] = [];

  for (const name of colNames) {
    const values = data.map((row) => row[name]);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
    const type = detectType(values);
    const nullCount = values.length - nonNull.length;
    const uniqueValues = new Set(nonNull.map(String));
    const topValues = getTopValues(values);

    const col: ColumnProfile = {
      name,
      type,
      count: values.length,
      nullCount,
      uniqueCount: uniqueValues.size,
      topValues,
      anomalies: [],
    };

    if (type === "number") {
      const nums = nonNull.map(Number).filter((n) => !isNaN(n));
      const stats = computeNumericStats(nums);
      col.min = stats.min;
      col.max = stats.max;
      col.mean = stats.mean;
      col.median = stats.median;
      col.stdDev = stats.stdDev;

      const colAnomalies = detectAnomalies(nums, name);
      col.anomalies = colAnomalies;
      allAnomalies.push(...colAnomalies);
    }

    if (type === "string") {
      const lengths = nonNull.map((v) => String(v).length);
      if (lengths.length > 0) {
        col.minLength = Math.min(...lengths);
        col.maxLength = Math.max(...lengths);
        col.avgLength = Math.round(lengths.reduce((s, l) => s + l, 0) / lengths.length);
      }
    }

    // Insights
    if (nullCount > 0) {
      const pct = Math.round((nullCount / values.length) * 100);
      if (pct > 50) {
        insights.push(`"${name}" is ${pct}% null — consider dropping or imputing.`);
      } else if (pct > 10) {
        insights.push(`"${name}" has ${pct}% missing values.`);
      }
    }

    if (uniqueValues.size === 1 && nonNull.length > 1) {
      insights.push(`"${name}" has only one unique value (${topValues[0]?.value}) — no variance.`);
    }

    if (uniqueValues.size === values.length && type === "string") {
      insights.push(`"${name}" has all unique values — possible ID/key column.`);
    }

    if (type === "number" && col.stdDev !== undefined && col.mean !== undefined && col.mean !== 0) {
      const cv = col.stdDev / Math.abs(col.mean);
      if (cv > 2) {
        insights.push(`"${name}" has very high variance (CV=${(cv).toFixed(2)}).`);
      }
    }

    columns.push(col);
  }

  const summary = `Dataset: ${data.length} rows × ${colNames.size} columns. ${columns.filter((c) => c.type === "number").length} numeric, ${columns.filter((c) => c.type === "string").length} text columns. ${allAnomalies.length} anomaly(ies) detected. ${insights.length} insight(s).`;

  return {
    rowCount: data.length,
    columnCount: colNames.size,
    columns,
    insights,
    anomalies: allAnomalies,
    summary,
  };
}
