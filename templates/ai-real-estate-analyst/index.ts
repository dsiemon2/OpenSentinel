/**
 * AI Real Estate Analyst Agent
 *
 * Researches properties, analyzes markets, compares listings,
 * estimates ROI, and generates investment reports.
 */

import { configure, ready, chatWithTools, storeMemory, searchMemories, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
});
await ready();

interface Property {
  address: string;
  city: string;
  state: string;
  listPrice: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  yearBuilt: number;
  propertyType: "single-family" | "condo" | "multi-family" | "townhouse" | "commercial";
  listingUrl?: string;
}

interface MarketAnalysis {
  city: string;
  state: string;
  medianPrice: string;
  pricePerSqft: string;
  marketTrend: "appreciating" | "stable" | "declining";
  avgDaysOnMarket: string;
  rentalYield: string;
  keyFactors: string[];
}

interface PropertyAnalysis {
  property: Property;
  estimatedValue: string;
  pricePerSqft: number;
  comparables: string[];
  investmentMetrics: {
    estimatedRent: string;
    grossYield: string;
    cashOnCash: string;
    capRate: string;
  };
  pros: string[];
  cons: string[];
  recommendation: "strong-buy" | "buy" | "hold" | "pass";
}

// Research a market
async function analyzeMarket(city: string, state: string): Promise<MarketAnalysis> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Research the real estate market in ${city}, ${state}.

Search for current data on:
1. Median home price and year-over-year change
2. Average price per square foot
3. Market trend (appreciating/stable/declining)
4. Average days on market
5. Rental market data (average rents by bedroom count)
6. Estimated rental yield
7. Key market drivers (employers, development projects, population trends)
8. Risk factors (flood zones, economic concentration, regulation)

Return JSON with:
- city, state
- medianPrice: formatted string
- pricePerSqft: formatted string
- marketTrend: "appreciating" | "stable" | "declining"
- avgDaysOnMarket: formatted string
- rentalYield: formatted percentage string
- keyFactors: array of factors affecting the market

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "real-estate-analyst");

  try {
    return JSON.parse(response.content);
  } catch {
    return {
      city,
      state,
      medianPrice: "N/A",
      pricePerSqft: "N/A",
      marketTrend: "stable",
      avgDaysOnMarket: "N/A",
      rentalYield: "N/A",
      keyFactors: [],
    };
  }
}

// Analyze a specific property
async function analyzeProperty(
  property: Property,
  market: MarketAnalysis
): Promise<PropertyAnalysis> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Analyze this property as an investment.

PROPERTY:
${JSON.stringify(property, null, 2)}

MARKET DATA:
${JSON.stringify(market, null, 2)}

Analyze and return JSON with:
- estimatedValue: what you estimate this property is worth based on market data
- pricePerSqft: list price / sqft (calculate it)
- comparables: array of 3-5 descriptions of comparable recent sales (search for them)
- investmentMetrics: {
    estimatedRent: monthly rent estimate,
    grossYield: annual rent / price as percentage,
    cashOnCash: assuming 25% down, estimated annual return on cash invested,
    capRate: NOI / price as percentage (estimate 40% expense ratio)
  }
- pros: array of positive factors (location, value, upside)
- cons: array of negative factors (age, price, market risk)
- recommendation: "strong-buy" | "buy" | "hold" | "pass"

Be realistic with estimates. Factor in the property's age, condition signals, and market context.

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "real-estate-analyst");

  try {
    const parsed = JSON.parse(response.content);
    return {
      property,
      estimatedValue: parsed.estimatedValue || "N/A",
      pricePerSqft: parsed.pricePerSqft || property.listPrice / property.sqft,
      comparables: parsed.comparables || [],
      investmentMetrics: parsed.investmentMetrics || {
        estimatedRent: "N/A",
        grossYield: "N/A",
        cashOnCash: "N/A",
        capRate: "N/A",
      },
      pros: parsed.pros || [],
      cons: parsed.cons || [],
      recommendation: parsed.recommendation || "hold",
    };
  } catch {
    return {
      property,
      estimatedValue: "N/A",
      pricePerSqft: property.listPrice / property.sqft,
      comparables: [],
      investmentMetrics: {
        estimatedRent: "N/A",
        grossYield: "N/A",
        cashOnCash: "N/A",
        capRate: "N/A",
      },
      pros: [],
      cons: [],
      recommendation: "hold",
    };
  }
}

// Generate investment comparison report
async function generateComparison(analyses: PropertyAnalysis[]): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a property comparison report for an investor.

PROPERTIES ANALYZED:
${JSON.stringify(
  analyses.map((a) => ({
    address: a.property.address,
    price: a.property.listPrice,
    sqft: a.property.sqft,
    pricePerSqft: a.pricePerSqft,
    estimatedRent: a.investmentMetrics.estimatedRent,
    grossYield: a.investmentMetrics.grossYield,
    capRate: a.investmentMetrics.capRate,
    recommendation: a.recommendation,
    pros: a.pros.length,
    cons: a.cons.length,
  })),
  null,
  2
)}

Format as:
1. Executive Summary — which property is the best investment and why
2. Comparison Table (address | price | $/sqft | rent | yield | cap rate | verdict)
3. Best for cash flow vs best for appreciation
4. Risk assessment for each
5. Final recommendation with reasoning

Keep it under 400 words. Write for a sophisticated investor.`,
    },
  ];

  const response = await chatWithTools(messages, "real-estate-analyst");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Real Estate Analyst starting...\n");

  // Properties to analyze — replace with your targets
  const properties: Property[] = [
    {
      address: "456 Oak Avenue",
      city: "Austin",
      state: "TX",
      listPrice: 425000,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1850,
      yearBuilt: 2018,
      propertyType: "single-family",
    },
    {
      address: "789 Pine Street #4B",
      city: "Austin",
      state: "TX",
      listPrice: 285000,
      bedrooms: 2,
      bathrooms: 2,
      sqft: 1100,
      yearBuilt: 2020,
      propertyType: "condo",
    },
    {
      address: "1200 Elm Drive",
      city: "Austin",
      state: "TX",
      listPrice: 680000,
      bedrooms: 4,
      bathrooms: 3,
      sqft: 2800,
      yearBuilt: 2005,
      propertyType: "single-family",
    },
  ];

  // Market analysis first
  const city = properties[0].city;
  const state = properties[0].state;
  console.log(`Analyzing ${city}, ${state} market...`);
  const market = await analyzeMarket(city, state);

  console.log(`\nMARKET: ${market.city}, ${market.state}`);
  console.log(`  Median price: ${market.medianPrice}`);
  console.log(`  Price/sqft: ${market.pricePerSqft}`);
  console.log(`  Trend: ${market.marketTrend}`);
  console.log(`  Days on market: ${market.avgDaysOnMarket}`);
  console.log(`  Rental yield: ${market.rentalYield}`);

  // Analyze each property
  const analyses: PropertyAnalysis[] = [];

  for (const property of properties) {
    console.log(`\nAnalyzing: ${property.address}...`);
    const analysis = await analyzeProperty(property, market);
    analyses.push(analysis);

    const recIcon =
      analysis.recommendation === "strong-buy" ? "[***]"
        : analysis.recommendation === "buy" ? "[**]"
        : analysis.recommendation === "hold" ? "[*]"
        : "[-]";

    console.log(`  ${recIcon} ${analysis.recommendation.toUpperCase()}`);
    console.log(`  Price: $${property.listPrice.toLocaleString()} | $${Math.round(analysis.pricePerSqft)}/sqft`);
    console.log(`  Est. Rent: ${analysis.investmentMetrics.estimatedRent} | Yield: ${analysis.investmentMetrics.grossYield}`);
    console.log(`  Pros: ${analysis.pros.slice(0, 2).join(", ")}`);
    console.log(`  Cons: ${analysis.cons.slice(0, 2).join(", ")}`);

    // Store for future tracking
    try {
      await storeMemory({
        userId: "real-estate-analyst",
        content: `${property.address}, ${city}: $${property.listPrice.toLocaleString()}, ${analysis.recommendation}. Yield: ${analysis.investmentMetrics.grossYield}`,
        type: "episodic",
        importance: 6,
        source: "property-analysis",
      });
    } catch {
      // Memory optional
    }
  }

  // Comparison report
  console.log("\n" + "=".repeat(60));
  console.log("INVESTMENT COMPARISON REPORT");
  console.log("=".repeat(60));
  const report = await generateComparison(analyses);
  console.log(report);
}

main().catch(console.error);
