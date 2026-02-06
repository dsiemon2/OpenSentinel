import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export type ChartType = "bar" | "line" | "pie" | "doughnut" | "scatter" | "area";

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartOptions {
  title?: string;
  width?: number;
  height?: number;
  legend?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface ChartResult {
  success: boolean;
  filePath?: string;
  svgContent?: string;
  error?: string;
}

// Default colors for charts
const DEFAULT_COLORS = [
  "#4285f4", // Blue
  "#ea4335", // Red
  "#fbbc04", // Yellow
  "#34a853", // Green
  "#ff6d01", // Orange
  "#46bdc6", // Teal
  "#7baaf7", // Light Blue
  "#f07b72", // Light Red
];

// Generate temp file path
function getTempPath(): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `sentinel-chart-${id}.svg`);
}

// Generate SVG bar chart
function generateBarChartSVG(data: ChartData, options: ChartOptions): string {
  const width = options.width || 600;
  const height = options.height || 400;
  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const allValues = data.datasets.flatMap((d) => d.data);
  const maxValue = Math.max(...allValues) * 1.1;
  const barGroupWidth = chartWidth / data.labels.length;
  const barWidth = barGroupWidth / (data.datasets.length + 1);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;

  // Title
  if (options.title) {
    svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold">${escapeXml(options.title)}</text>`;
  }

  // Y-axis
  svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#ccc"/>`;

  // X-axis
  svg += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#ccc"/>`;

  // Y-axis labels and grid lines
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight * i) / 5;
    const value = Math.round(maxValue * (1 - i / 5));
    svg += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#eee"/>`;
    svg += `<text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="10">${value}</text>`;
  }

  // Bars
  data.datasets.forEach((dataset, datasetIndex) => {
    const color = dataset.backgroundColor || DEFAULT_COLORS[datasetIndex % DEFAULT_COLORS.length];

    dataset.data.forEach((value, index) => {
      const x = padding + index * barGroupWidth + datasetIndex * barWidth + barWidth / 2;
      const barHeight = (value / maxValue) * chartHeight;
      const y = height - padding - barHeight;

      svg += `<rect x="${x}" y="${y}" width="${barWidth * 0.8}" height="${barHeight}" fill="${color}"/>`;
    });
  });

  // X-axis labels
  data.labels.forEach((label, index) => {
    const x = padding + index * barGroupWidth + barGroupWidth / 2;
    svg += `<text x="${x}" y="${height - padding + 20}" text-anchor="middle" font-size="10">${escapeXml(label)}</text>`;
  });

  // Legend
  if (options.legend !== false && data.datasets.length > 1) {
    data.datasets.forEach((dataset, index) => {
      const legendX = width - padding - 100;
      const legendY = padding + index * 20;
      const color = dataset.backgroundColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
      svg += `<rect x="${legendX}" y="${legendY}" width="12" height="12" fill="${color}"/>`;
      svg += `<text x="${legendX + 16}" y="${legendY + 10}" font-size="10">${escapeXml(dataset.label)}</text>`;
    });
  }

  svg += "</svg>";
  return svg;
}

// Generate SVG line chart
function generateLineChartSVG(data: ChartData, options: ChartOptions): string {
  const width = options.width || 600;
  const height = options.height || 400;
  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const allValues = data.datasets.flatMap((d) => d.data);
  const maxValue = Math.max(...allValues) * 1.1;
  const pointSpacing = chartWidth / (data.labels.length - 1 || 1);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;

  // Title
  if (options.title) {
    svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold">${escapeXml(options.title)}</text>`;
  }

  // Axes
  svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#ccc"/>`;
  svg += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#ccc"/>`;

  // Grid lines
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight * i) / 5;
    const value = Math.round(maxValue * (1 - i / 5));
    svg += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#eee"/>`;
    svg += `<text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="10">${value}</text>`;
  }

  // Lines
  data.datasets.forEach((dataset, datasetIndex) => {
    const color = dataset.borderColor || DEFAULT_COLORS[datasetIndex % DEFAULT_COLORS.length];
    const points: string[] = [];

    dataset.data.forEach((value, index) => {
      const x = padding + index * pointSpacing;
      const y = height - padding - (value / maxValue) * chartHeight;
      points.push(`${x},${y}`);
    });

    svg += `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2"/>`;

    // Data points
    dataset.data.forEach((value, index) => {
      const x = padding + index * pointSpacing;
      const y = height - padding - (value / maxValue) * chartHeight;
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`;
    });
  });

  // X-axis labels
  data.labels.forEach((label, index) => {
    const x = padding + index * pointSpacing;
    svg += `<text x="${x}" y="${height - padding + 20}" text-anchor="middle" font-size="10">${escapeXml(label)}</text>`;
  });

  // Legend
  if (options.legend !== false && data.datasets.length > 1) {
    data.datasets.forEach((dataset, index) => {
      const legendX = width - padding - 100;
      const legendY = padding + index * 20;
      const color = dataset.borderColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
      svg += `<line x1="${legendX}" y1="${legendY + 6}" x2="${legendX + 12}" y2="${legendY + 6}" stroke="${color}" stroke-width="2"/>`;
      svg += `<text x="${legendX + 16}" y="${legendY + 10}" font-size="10">${escapeXml(dataset.label)}</text>`;
    });
  }

  svg += "</svg>";
  return svg;
}

// Generate SVG pie chart
function generatePieChartSVG(data: ChartData, options: ChartOptions): string {
  const width = options.width || 400;
  const height = options.height || 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 60;

  const values = data.datasets[0]?.data || [];
  const total = values.reduce((sum, v) => sum + v, 0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;

  // Title
  if (options.title) {
    svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold">${escapeXml(options.title)}</text>`;
  }

  let startAngle = -Math.PI / 2;

  values.forEach((value, index) => {
    const sliceAngle = (value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
    const colors = data.datasets[0]?.backgroundColor;
    const color = Array.isArray(colors)
      ? colors[index % colors.length]
      : DEFAULT_COLORS[index % DEFAULT_COLORS.length];

    svg += `<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${color}"/>`;

    // Label
    const labelAngle = startAngle + sliceAngle / 2;
    const labelX = centerX + (radius * 0.7) * Math.cos(labelAngle);
    const labelY = centerY + (radius * 0.7) * Math.sin(labelAngle);
    const percentage = Math.round((value / total) * 100);

    svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="12" fill="white" font-weight="bold">${percentage}%</text>`;

    startAngle = endAngle;
  });

  // Legend
  if (options.legend !== false) {
    data.labels.forEach((label, index) => {
      const legendY = height - 40 + (index % 2) * 20;
      const legendX = 20 + Math.floor(index / 2) * 120;
      const colors = data.datasets[0]?.backgroundColor;
      const color = Array.isArray(colors)
        ? colors[index % colors.length]
        : DEFAULT_COLORS[index % DEFAULT_COLORS.length];

      svg += `<rect x="${legendX}" y="${legendY}" width="12" height="12" fill="${color}"/>`;
      svg += `<text x="${legendX + 16}" y="${legendY + 10}" font-size="10">${escapeXml(label)}</text>`;
    });
  }

  svg += "</svg>";
  return svg;
}

// Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Generate chart based on type
export async function generateChart(
  type: ChartType,
  data: ChartData,
  filename?: string,
  options: ChartOptions = {}
): Promise<ChartResult> {
  const filePath = filename
    ? isPathAllowed(filename)
      ? filename
      : join(tmpdir(), filename)
    : getTempPath();

  try {
    await mkdir(dirname(filePath), { recursive: true });

    let svgContent: string;

    switch (type) {
      case "bar":
        svgContent = generateBarChartSVG(data, options);
        break;
      case "line":
      case "area":
        svgContent = generateLineChartSVG(data, options);
        break;
      case "pie":
      case "doughnut":
        svgContent = generatePieChartSVG(data, options);
        break;
      case "scatter":
        // Scatter uses line chart without connecting lines
        svgContent = generateLineChartSVG(data, { ...options });
        break;
      default:
        return { success: false, error: `Unsupported chart type: ${type}` };
    }

    await writeFile(filePath, svgContent, "utf-8");

    return {
      success: true,
      filePath,
      svgContent,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Quick chart from simple data
export async function quickChart(
  type: ChartType,
  labels: string[],
  values: number[],
  title?: string,
  filename?: string
): Promise<ChartResult> {
  const data: ChartData = {
    labels,
    datasets: [
      {
        label: title || "Data",
        data: values,
        backgroundColor: DEFAULT_COLORS,
      },
    ],
  };

  return generateChart(type, data, filename, { title });
}

export default {
  generateChart,
  quickChart,
};
