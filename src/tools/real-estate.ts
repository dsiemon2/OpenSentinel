/**
 * Real Estate Analyst — Property analysis, market research, ROI estimation
 *
 * Analyze investment properties, compute ROI/cap rate,
 * and compare properties side by side.
 */

export interface PropertyAnalysis {
  address: string;
  type: string;
  purchasePrice: number;
  monthlyRent?: number;
  expenses: PropertyExpenses;
  metrics: InvestmentMetrics;
  cashFlow: CashFlowAnalysis;
  summary: string;
}

export interface PropertyExpenses {
  mortgage?: number;
  propertyTax?: number;
  insurance?: number;
  maintenance?: number;
  management?: number;
  vacancy?: number;
  hoa?: number;
  utilities?: number;
  totalMonthly: number;
  totalAnnual: number;
}

export interface InvestmentMetrics {
  capRate: number;
  cashOnCashReturn: number;
  grossRentMultiplier: number;
  roi: number;
  breakEvenRent: number;
  pricePerUnit?: number;
}

export interface CashFlowAnalysis {
  grossMonthlyIncome: number;
  netMonthlyIncome: number;
  annualCashFlow: number;
  monthlyMortgage: number;
  isPositiveCashFlow: boolean;
}

export interface PropertyComparison {
  properties: Array<{ address: string; price: number; capRate: number; cashFlow: number; roi: number }>;
  bestValue: string;
  summary: string;
}

/**
 * Analyze a property for investment potential
 */
export function analyzeProperty(input: {
  address: string;
  type?: string;
  purchasePrice: number;
  downPayment?: number;
  interestRate?: number;
  loanTerm?: number;
  monthlyRent?: number;
  units?: number;
  propertyTax?: number;
  insurance?: number;
  maintenance?: number;
  management?: number;
  vacancyRate?: number;
  hoa?: number;
  utilities?: number;
}): PropertyAnalysis {
  const price = input.purchasePrice;
  const downPayment = input.downPayment || price * 0.2;
  const loanAmount = price - downPayment;
  const rate = (input.interestRate || 7) / 100 / 12;
  const term = (input.loanTerm || 30) * 12;
  const units = input.units || 1;
  const type = input.type || "Single Family";

  // Calculate mortgage payment
  const mortgage = rate > 0
    ? (loanAmount * rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1)
    : loanAmount / term;

  // Monthly expenses
  const propertyTax = input.propertyTax || (price * 0.012) / 12;
  const insurance = input.insurance || (price * 0.005) / 12;
  const maintenance = input.maintenance || (price * 0.01) / 12;
  const management = input.management || (input.monthlyRent || 0) * 0.08;
  const vacancy = (input.monthlyRent || 0) * (input.vacancyRate || 0.05);
  const hoa = input.hoa || 0;
  const utilities = input.utilities || 0;

  const totalMonthly = propertyTax + insurance + maintenance + management + vacancy + hoa + utilities;
  const totalAnnual = totalMonthly * 12;

  const expenses: PropertyExpenses = {
    mortgage: Math.round(mortgage * 100) / 100,
    propertyTax: Math.round(propertyTax * 100) / 100,
    insurance: Math.round(insurance * 100) / 100,
    maintenance: Math.round(maintenance * 100) / 100,
    management: Math.round(management * 100) / 100,
    vacancy: Math.round(vacancy * 100) / 100,
    hoa,
    utilities,
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalAnnual: Math.round(totalAnnual * 100) / 100,
  };

  // Metrics
  const grossRent = (input.monthlyRent || 0) * 12;
  const noi = grossRent - totalAnnual;
  const capRate = price > 0 ? (noi / price) * 100 : 0;
  const annualCashFlow = noi - mortgage * 12;
  const cashOnCash = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
  const grm = grossRent > 0 ? price / grossRent : 0;
  const roi = price > 0 ? (annualCashFlow / price) * 100 : 0;
  const breakEvenRent = (totalMonthly + mortgage);

  const metrics: InvestmentMetrics = {
    capRate: Math.round(capRate * 100) / 100,
    cashOnCashReturn: Math.round(cashOnCash * 100) / 100,
    grossRentMultiplier: Math.round(grm * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    breakEvenRent: Math.round(breakEvenRent * 100) / 100,
    pricePerUnit: units > 1 ? Math.round(price / units) : undefined,
  };

  const cashFlow: CashFlowAnalysis = {
    grossMonthlyIncome: input.monthlyRent || 0,
    netMonthlyIncome: Math.round((noi / 12) * 100) / 100,
    annualCashFlow: Math.round(annualCashFlow * 100) / 100,
    monthlyMortgage: Math.round(mortgage * 100) / 100,
    isPositiveCashFlow: annualCashFlow > 0,
  };

  const verdict = capRate >= 8 ? "Strong investment" :
    capRate >= 5 ? "Moderate investment" :
    capRate >= 3 ? "Below average returns" :
    "Poor investment";

  return {
    address: input.address,
    type,
    purchasePrice: price,
    monthlyRent: input.monthlyRent,
    expenses,
    metrics,
    cashFlow,
    summary: `${type} at ${input.address}: $${price.toLocaleString()}, rent $${(input.monthlyRent || 0).toLocaleString()}/mo. Cap rate: ${capRate.toFixed(1)}%. Cash flow: $${Math.round(annualCashFlow).toLocaleString()}/yr. ${verdict}.`,
  };
}

/**
 * Compare multiple properties side by side
 */
export function compareProperties(properties: PropertyAnalysis[]): PropertyComparison {
  const list = properties.map((p) => ({
    address: p.address,
    price: p.purchasePrice,
    capRate: p.metrics.capRate,
    cashFlow: p.cashFlow.annualCashFlow,
    roi: p.metrics.roi,
  }));

  const best = list.reduce((a, b) => (a.capRate > b.capRate ? a : b));

  return {
    properties: list,
    bestValue: best.address,
    summary: `Compared ${list.length} properties. Best cap rate: ${best.address} (${best.capRate.toFixed(1)}%). Average cap rate: ${(list.reduce((s, p) => s + p.capRate, 0) / list.length).toFixed(1)}%.`,
  };
}

/**
 * Estimate mortgage payment
 */
export function calculateMortgage(
  principal: number,
  annualRate: number,
  years: number
): { monthlyPayment: number; totalPaid: number; totalInterest: number } {
  const rate = annualRate / 100 / 12;
  const n = years * 12;
  const monthly = rate > 0
    ? (principal * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)
    : principal / n;
  const total = monthly * n;

  return {
    monthlyPayment: Math.round(monthly * 100) / 100,
    totalPaid: Math.round(total * 100) / 100,
    totalInterest: Math.round((total - principal) * 100) / 100,
  };
}
