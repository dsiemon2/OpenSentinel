import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export interface ReportSection {
  title: string;
  content?: string; // HTML or plain text
  type?: "text" | "metrics" | "table" | "progress" | "timeline" | "kv";
  data?: unknown; // Type depends on section type
}

export interface MetricData {
  label: string;
  value: number | string;
  unit?: string;
  change?: number; // percentage change
  icon?: string; // emoji fallback
}

export interface ProgressData {
  label: string;
  value: number; // 0-100
  color?: string;
  target?: number;
}

export interface TimelineEntry {
  date: string;
  title: string;
  description?: string;
  status?: "completed" | "active" | "pending" | "failed";
}

export interface KVData {
  key: string;
  value: string | number;
}

export interface ReportOptions {
  title: string;
  subtitle?: string;
  theme?: "light" | "dark" | "corporate" | "minimal";
  logo?: string; // URL or base64
  footer?: string;
  timestamp?: boolean;
  author?: string;
}

export interface ReportResult {
  success: boolean;
  filePath?: string;
  html?: string;
  error?: string;
}

function getTempPath(): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `sentinel-report-${id}.html`);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const THEME_STYLES: Record<string, string> = {
  light: `
    :root { --bg: #ffffff; --surface: #f8f9fa; --border: #e9ecef; --text: #212529; --text-muted: #6c757d; --primary: #0d6efd; --success: #198754; --danger: #dc3545; --warning: #ffc107; }
  `,
  dark: `
    :root { --bg: #1a1a2e; --surface: #16213e; --border: #0f3460; --text: #e0e0e0; --text-muted: #a0a0a0; --primary: #4fc3f7; --success: #66bb6a; --danger: #ef5350; --warning: #ffa726; }
  `,
  corporate: `
    :root { --bg: #ffffff; --surface: #f5f6f8; --border: #d4d8dd; --text: #1a2332; --text-muted: #5a6570; --primary: #1e3a5f; --success: #27ae60; --danger: #e74c3c; --warning: #f39c12; }
  `,
  minimal: `
    :root { --bg: #fafafa; --surface: #ffffff; --border: #eee; --text: #333; --text-muted: #999; --primary: #333; --success: #4caf50; --danger: #f44336; --warning: #ff9800; }
  `,
};

function renderMetrics(metrics: MetricData[]): string {
  return `<div class="metrics-grid">${metrics.map((m) => {
    const changeHtml = m.change !== undefined
      ? `<span class="metric-change ${m.change >= 0 ? "positive" : "negative"}">${m.change >= 0 ? "+" : ""}${m.change.toFixed(1)}%</span>`
      : "";
    return `<div class="metric-card">
      <div class="metric-label">${escapeHtml(m.label)}</div>
      <div class="metric-value">${escapeHtml(String(m.value))}${m.unit ? `<span class="metric-unit">${escapeHtml(m.unit)}</span>` : ""}</div>
      ${changeHtml}
    </div>`;
  }).join("")}</div>`;
}

function renderTable(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "<p>No data</p>";
  const keys = Object.keys(data[0]);
  return `<table>
    <thead><tr>${keys.map((k) => `<th>${escapeHtml(k)}</th>`).join("")}</tr></thead>
    <tbody>${data.map((row) => `<tr>${keys.map((k) => `<td>${escapeHtml(String(row[k] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

function renderProgress(items: ProgressData[]): string {
  return `<div class="progress-list">${items.map((p) => {
    const color = p.color || (p.value >= 80 ? "var(--success)" : p.value >= 50 ? "var(--warning)" : "var(--danger)");
    const targetMarker = p.target !== undefined
      ? `<div class="progress-target" style="left: ${p.target}%;" title="Target: ${p.target}%"></div>`
      : "";
    return `<div class="progress-item">
      <div class="progress-header">
        <span class="progress-label">${escapeHtml(p.label)}</span>
        <span class="progress-value">${p.value}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${Math.min(p.value, 100)}%; background: ${color};"></div>
        ${targetMarker}
      </div>
    </div>`;
  }).join("")}</div>`;
}

function renderTimeline(entries: TimelineEntry[]): string {
  const statusColors: Record<string, string> = {
    completed: "var(--success)",
    active: "var(--primary)",
    pending: "var(--text-muted)",
    failed: "var(--danger)",
  };
  return `<div class="timeline">${entries.map((e) => {
    const color = statusColors[e.status || "pending"] || "var(--text-muted)";
    return `<div class="timeline-item">
      <div class="timeline-dot" style="background: ${color};"></div>
      <div class="timeline-content">
        <div class="timeline-date">${escapeHtml(e.date)}</div>
        <div class="timeline-title">${escapeHtml(e.title)}</div>
        ${e.description ? `<div class="timeline-desc">${escapeHtml(e.description)}</div>` : ""}
      </div>
    </div>`;
  }).join("")}</div>`;
}

function renderKV(items: KVData[]): string {
  return `<dl class="kv-list">${items.map((kv) =>
    `<div class="kv-row"><dt>${escapeHtml(kv.key)}</dt><dd>${escapeHtml(String(kv.value))}</dd></div>`
  ).join("")}</dl>`;
}

function renderSection(section: ReportSection): string {
  let body = "";

  switch (section.type) {
    case "metrics":
      body = renderMetrics(section.data as MetricData[]);
      break;
    case "table":
      body = renderTable(section.data as Record<string, unknown>[]);
      break;
    case "progress":
      body = renderProgress(section.data as ProgressData[]);
      break;
    case "timeline":
      body = renderTimeline(section.data as TimelineEntry[]);
      break;
    case "kv":
      body = renderKV(section.data as KVData[]);
      break;
    default:
      body = section.content || "";
  }

  return `<section class="report-section">
    <h2>${escapeHtml(section.title)}</h2>
    ${body}
  </section>`;
}

/**
 * Generate a styled HTML report.
 */
export async function generateReport(
  sections: ReportSection[],
  filename?: string,
  options: ReportOptions = { title: "Report" }
): Promise<ReportResult> {
  const filePath = filename
    ? isPathAllowed(filename) ? filename : join(tmpdir(), filename)
    : getTempPath();

  try {
    await mkdir(dirname(filePath), { recursive: true });

    const theme = options.theme || "light";
    const timestamp = options.timestamp !== false ? new Date().toLocaleString() : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(options.title)}</title>
<style>
${THEME_STYLES[theme] || THEME_STYLES.light}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
.report { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
.report-header { margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid var(--primary); }
.report-header h1 { font-size: 28px; margin-bottom: 4px; color: var(--text); }
.report-header .subtitle { font-size: 16px; color: var(--text-muted); }
.report-header .meta { font-size: 12px; color: var(--text-muted); margin-top: 8px; }
.report-section { margin-bottom: 32px; }
.report-section h2 { font-size: 20px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
.metric-label { font-size: 13px; color: var(--text-muted); margin-bottom: 4px; }
.metric-value { font-size: 28px; font-weight: 700; }
.metric-unit { font-size: 14px; color: var(--text-muted); margin-left: 4px; }
.metric-change { font-size: 13px; font-weight: 600; }
.metric-change.positive { color: var(--success); }
.metric-change.negative { color: var(--danger); }
table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 8px; overflow: hidden; }
th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); font-size: 14px; }
th { background: var(--border); font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
tr:last-child td { border-bottom: none; }
.progress-list { display: flex; flex-direction: column; gap: 12px; }
.progress-header { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; }
.progress-label { font-weight: 500; }
.progress-value { color: var(--text-muted); font-weight: 600; }
.progress-track { height: 8px; background: var(--border); border-radius: 4px; position: relative; overflow: visible; }
.progress-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
.progress-target { position: absolute; top: -3px; width: 2px; height: 14px; background: var(--text); border-radius: 1px; }
.timeline { position: relative; padding-left: 24px; }
.timeline::before { content: ''; position: absolute; left: 6px; top: 8px; bottom: 8px; width: 2px; background: var(--border); }
.timeline-item { position: relative; margin-bottom: 20px; }
.timeline-dot { position: absolute; left: -22px; top: 6px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--bg); }
.timeline-date { font-size: 12px; color: var(--text-muted); }
.timeline-title { font-weight: 600; font-size: 15px; }
.timeline-desc { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
.kv-list { display: flex; flex-direction: column; gap: 8px; }
.kv-row { display: flex; padding: 8px 0; border-bottom: 1px solid var(--border); }
.kv-row dt { width: 200px; flex-shrink: 0; font-weight: 600; font-size: 14px; color: var(--text-muted); }
.kv-row dd { flex: 1; font-size: 14px; }
.report-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted); text-align: center; }
@media print { body { background: white; } .report { max-width: none; padding: 20px; } }
</style>
</head>
<body>
<div class="report">
  <div class="report-header">
    <h1>${escapeHtml(options.title)}</h1>
    ${options.subtitle ? `<div class="subtitle">${escapeHtml(options.subtitle)}</div>` : ""}
    <div class="meta">
      ${options.author ? `Prepared by ${escapeHtml(options.author)}` : ""}
      ${timestamp ? `${options.author ? " | " : ""}Generated: ${escapeHtml(timestamp)}` : ""}
    </div>
  </div>
  ${sections.map(renderSection).join("\n  ")}
  <div class="report-footer">${escapeHtml(options.footer || "Generated by OpenSentinel")}</div>
</div>
</body>
</html>`;

    await writeFile(filePath, html, "utf-8");

    return { success: true, filePath, html };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Quick summary report from key-value pairs.
 */
export async function quickReport(
  title: string,
  data: Record<string, string | number>,
  filename?: string
): Promise<ReportResult> {
  const kvData: KVData[] = Object.entries(data).map(([key, value]) => ({ key, value }));
  return generateReport(
    [{ title: "Summary", type: "kv", data: kvData }],
    filename,
    { title }
  );
}

export default { generateReport, quickReport };
