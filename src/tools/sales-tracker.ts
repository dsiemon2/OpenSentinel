/**
 * Sales Agent — CRM-lite lead and deal pipeline tracking
 *
 * Track leads, deals, and sales pipeline stages entirely in-memory.
 * Perfect for solo founders and small teams using AI to manage sales.
 */

export interface Lead {
  id: string;
  name: string;
  email?: string;
  company?: string;
  source?: string;
  status: "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  value?: number;
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
  nextFollowUp?: Date;
}

export interface PipelineSummary {
  totalLeads: number;
  byStatus: Record<string, number>;
  totalValue: number;
  wonValue: number;
  lostValue: number;
  openValue: number;
  conversionRate: string;
  summary: string;
}

const leads = new Map<string, Lead>();
let nextId = 1;

const STAGES: Lead["status"][] = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

export function addLead(
  name: string,
  options: { email?: string; company?: string; source?: string; value?: number; notes?: string } = {}
): Lead {
  const id = `lead_${nextId++}`;
  const lead: Lead = {
    id,
    name,
    email: options.email,
    company: options.company,
    source: options.source,
    status: "new",
    value: options.value,
    notes: options.notes ? [options.notes] : [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  leads.set(id, lead);
  return lead;
}

export function updateLead(
  nameOrId: string,
  updates: { status?: Lead["status"]; value?: number; notes?: string; email?: string; nextFollowUp?: string }
): Lead {
  const lead = findLead(nameOrId);
  if (!lead) throw new Error(`Lead not found: ${nameOrId}`);

  if (updates.status && STAGES.includes(updates.status)) lead.status = updates.status;
  if (updates.value !== undefined) lead.value = updates.value;
  if (updates.email) lead.email = updates.email;
  if (updates.notes) lead.notes.push(updates.notes);
  if (updates.nextFollowUp) lead.nextFollowUp = new Date(updates.nextFollowUp);
  lead.updatedAt = new Date();

  return lead;
}

export function removeLead(nameOrId: string): boolean {
  const lead = findLead(nameOrId);
  if (!lead) return false;
  leads.delete(lead.id);
  return true;
}

export function getLead(nameOrId: string): Lead | undefined {
  return findLead(nameOrId);
}

export function listLeads(filter?: { status?: Lead["status"]; company?: string }): Lead[] {
  let result = Array.from(leads.values());
  if (filter?.status) result = result.filter((l) => l.status === filter.status);
  if (filter?.company) result = result.filter((l) => l.company?.toLowerCase().includes(filter.company!.toLowerCase()));
  return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function getPipelineSummary(): PipelineSummary {
  const all = Array.from(leads.values());
  const byStatus: Record<string, number> = {};
  for (const s of STAGES) byStatus[s] = 0;
  for (const lead of all) byStatus[lead.status]++;

  const wonValue = all.filter((l) => l.status === "won").reduce((s, l) => s + (l.value || 0), 0);
  const lostValue = all.filter((l) => l.status === "lost").reduce((s, l) => s + (l.value || 0), 0);
  const openValue = all.filter((l) => !["won", "lost"].includes(l.status)).reduce((s, l) => s + (l.value || 0), 0);
  const totalValue = all.reduce((s, l) => s + (l.value || 0), 0);
  const closed = all.filter((l) => ["won", "lost"].includes(l.status));
  const conversionRate = closed.length > 0
    ? `${((closed.filter((l) => l.status === "won").length / closed.length) * 100).toFixed(1)}%`
    : "N/A";

  return {
    totalLeads: all.length,
    byStatus,
    totalValue,
    wonValue,
    lostValue,
    openValue,
    conversionRate,
    summary: `Pipeline: ${all.length} leads, $${openValue.toLocaleString()} open, $${wonValue.toLocaleString()} won. Conversion: ${conversionRate}.`,
  };
}

export function getFollowUps(): Lead[] {
  const now = new Date();
  return Array.from(leads.values())
    .filter((l) => l.nextFollowUp && l.nextFollowUp <= now && !["won", "lost"].includes(l.status))
    .sort((a, b) => (a.nextFollowUp!.getTime() - b.nextFollowUp!.getTime()));
}

export function clearLeads(): void {
  leads.clear();
  nextId = 1;
}

function findLead(nameOrId: string): Lead | undefined {
  const byId = leads.get(nameOrId);
  if (byId) return byId;
  const lower = nameOrId.toLowerCase();
  for (const lead of leads.values()) {
    if (lead.name.toLowerCase() === lower) return lead;
  }
  return undefined;
}
