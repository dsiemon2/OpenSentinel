/**
 * Unit Converter Tool
 * Convert between units of measurement
 */

export interface ConversionResult {
  success: boolean;
  result?: { value: number; from: string; to: string; formatted: string };
  error?: string;
}

type ConversionMap = Record<string, Record<string, number>>;

// All values are conversion factors to the base unit
const LENGTH: ConversionMap = {
  // Base: meters
  mm: { toBase: 0.001 }, cm: { toBase: 0.01 }, m: { toBase: 1 }, km: { toBase: 1000 },
  in: { toBase: 0.0254 }, ft: { toBase: 0.3048 }, yd: { toBase: 0.9144 }, mi: { toBase: 1609.344 },
  nm: { toBase: 1852 },
};

const WEIGHT: ConversionMap = {
  // Base: grams
  mg: { toBase: 0.001 }, g: { toBase: 1 }, kg: { toBase: 1000 }, t: { toBase: 1000000 },
  oz: { toBase: 28.3495 }, lb: { toBase: 453.592 }, st: { toBase: 6350.29 },
};

const VOLUME: ConversionMap = {
  // Base: liters
  ml: { toBase: 0.001 }, l: { toBase: 1 }, gal: { toBase: 3.78541 },
  qt: { toBase: 0.946353 }, pt: { toBase: 0.473176 }, cup: { toBase: 0.236588 },
  floz: { toBase: 0.0295735 }, tbsp: { toBase: 0.0147868 }, tsp: { toBase: 0.00492892 },
};

const DATA_SIZE: ConversionMap = {
  // Base: bytes
  b: { toBase: 1 }, kb: { toBase: 1024 }, mb: { toBase: 1048576 }, gb: { toBase: 1073741824 },
  tb: { toBase: 1099511627776 }, pb: { toBase: 1125899906842624 },
  bit: { toBase: 0.125 }, kbit: { toBase: 128 }, mbit: { toBase: 131072 }, gbit: { toBase: 134217728 },
};

const TIME: ConversionMap = {
  // Base: seconds
  ms: { toBase: 0.001 }, s: { toBase: 1 }, min: { toBase: 60 }, hr: { toBase: 3600 },
  day: { toBase: 86400 }, week: { toBase: 604800 }, month: { toBase: 2592000 }, year: { toBase: 31536000 },
};

const SPEED: ConversionMap = {
  // Base: m/s
  "m/s": { toBase: 1 }, "km/h": { toBase: 0.277778 }, mph: { toBase: 0.44704 },
  knot: { toBase: 0.514444 }, "ft/s": { toBase: 0.3048 },
};

const CATEGORIES: Record<string, ConversionMap> = {
  length: LENGTH,
  weight: WEIGHT,
  volume: VOLUME,
  data: DATA_SIZE,
  time: TIME,
  speed: SPEED,
};

// Temperature conversion (special case - not multiplicative)
function convertTemperature(value: number, from: string, to: string): number {
  // Convert to Celsius first
  let celsius: number;
  switch (from.toLowerCase()) {
    case "c": case "celsius": celsius = value; break;
    case "f": case "fahrenheit": celsius = (value - 32) * 5 / 9; break;
    case "k": case "kelvin": celsius = value - 273.15; break;
    default: throw new Error(`Unknown temperature unit: ${from}`);
  }

  // Convert from Celsius to target
  switch (to.toLowerCase()) {
    case "c": case "celsius": return celsius;
    case "f": case "fahrenheit": return celsius * 9 / 5 + 32;
    case "k": case "kelvin": return celsius + 273.15;
    default: throw new Error(`Unknown temperature unit: ${to}`);
  }
}

// Generic unit conversion
function convertUnit(value: number, from: string, to: string, conversionMap: ConversionMap): number {
  const fromFactor = conversionMap[from.toLowerCase()];
  const toFactor = conversionMap[to.toLowerCase()];

  if (!fromFactor) throw new Error(`Unknown unit: ${from}`);
  if (!toFactor) throw new Error(`Unknown unit: ${to}`);

  const baseValue = value * fromFactor.toBase;
  return baseValue / toFactor.toBase;
}

// Detect which category a unit belongs to
function detectCategory(unit: string): string | null {
  const lower = unit.toLowerCase();
  if (["c", "f", "k", "celsius", "fahrenheit", "kelvin"].includes(lower)) return "temperature";

  for (const [category, map] of Object.entries(CATEGORIES)) {
    if (lower in map) return category;
  }
  return null;
}

// List available units for a category
export function listUnits(category?: string): Record<string, string[]> {
  if (category) {
    if (category === "temperature") return { temperature: ["C", "F", "K"] };
    const map = CATEGORIES[category];
    return map ? { [category]: Object.keys(map) } : {};
  }

  const result: Record<string, string[]> = { temperature: ["C", "F", "K"] };
  for (const [cat, map] of Object.entries(CATEGORIES)) {
    result[cat] = Object.keys(map);
  }
  return result;
}

// Main conversion function
export function convert(value: number, from: string, to: string): ConversionResult {
  try {
    const category = detectCategory(from);
    if (!category) {
      return { success: false, error: `Unknown unit: ${from}. Use listUnits() to see available units.` };
    }

    let result: number;
    if (category === "temperature") {
      result = convertTemperature(value, from, to);
    } else {
      result = convertUnit(value, from, to, CATEGORIES[category]);
    }

    // Smart formatting
    const formatted = result < 0.01 || result > 1000000
      ? result.toExponential(4)
      : Number(result.toPrecision(8)).toString();

    return {
      success: true,
      result: { value: result, from, to, formatted: `${value} ${from} = ${formatted} ${to}` },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Main entry point
export async function unitConverter(
  action: string,
  value: number,
  from: string,
  to: string
): Promise<ConversionResult> {
  if (action === "list") {
    return { success: true, result: listUnits(from) as any };
  }
  return convert(value, from, to);
}

export default { convert, listUnits, unitConverter };
