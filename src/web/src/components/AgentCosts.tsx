import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface CostSummary {
  totalCost: number;
  costByTier: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
  estimatedMonthlyCost: number;
  costTrend: { direction: string; strength: number };
}

interface CostForecast {
  forecastedDailyCost: number;
  estimatedMonthlyCost: number;
  trend: string;
  confidence: number;
}

interface AgentInfo {
  id: string;
  type: string;
  name: string;
  status: string;
  objective: string;
  tokensUsed: number;
  tokenBudget: number;
}

const COST_PER_TOKEN_INPUT = 0.000003;
const COST_PER_TOKEN_OUTPUT = 0.000015;

export default function AgentCosts() {
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [forecast, setForecast] = useState<CostForecast | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  useEffect(() => {
    apiFetch("/api/brain/scores").then(r => r.json()).then(d => setCost(d.costSummary)).catch(() => {});
    apiFetch("/api/brain/cost/forecast?days=7").then(r => r.json()).then(setForecast).catch(() => {});
    apiFetch("/api/brain/agents").then(r => r.json()).then(setAgents).catch(() => {});

    const interval = setInterval(() => {
      apiFetch("/api/brain/scores").then(r => r.json()).then(d => setCost(d.costSummary)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const trendIcon = cost?.costTrend.direction === "up" ? "↑" : cost?.costTrend.direction === "down" ? "↓" : "→";
  const trendColor = cost?.costTrend.direction === "up" ? "#ef4444" : cost?.costTrend.direction === "down" ? "#22c55e" : "var(--text-secondary)";

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Agent Costs</h2>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total Cost</div>
          <div className="stat-value">${(cost?.totalCost ?? 0).toFixed(4)}</div>
          <div className="stat-subtitle">{cost?.requestCount ?? 0} requests</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Estimated Monthly</div>
          <div className="stat-value">${(cost?.estimatedMonthlyCost ?? forecast?.estimatedMonthlyCost ?? 0).toFixed(2)}</div>
          <div className="stat-subtitle">
            Daily: ${(forecast?.forecastedDailyCost ?? 0).toFixed(4)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Trend</div>
          <div className="stat-value" style={{ color: trendColor }}>
            {trendIcon} {cost?.costTrend.direction ?? "stable"}
          </div>
          <div className="stat-subtitle">
            Strength: {((cost?.costTrend.strength ?? 0) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Cost by Tier */}
      {cost?.costByTier && Object.keys(cost.costByTier).length > 0 && (
        <div className="card">
          <h3>Cost by Model Tier</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th style={{ textAlign: "right" }}>Cost</th>
                <th style={{ textAlign: "right" }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cost.costByTier)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([tier, amount]) => (
                  <tr key={tier}>
                    <td>{tier}</td>
                    <td style={{ textAlign: "right" }}>${(amount as number).toFixed(6)}</td>
                    <td style={{ textAlign: "right" }}>
                      {cost.totalCost > 0 ? ((amount as number / cost.totalCost) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-Agent Costs */}
      <div className="card">
        <h3>Per-Agent Token Usage</h3>
        {agents.length === 0 ? (
          <div className="empty-state">
            <p>No agent data available</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Type</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Tokens Used</th>
                <th style={{ textAlign: "right" }}>Budget</th>
                <th style={{ textAlign: "right" }}>Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => {
                const estCost = agent.tokensUsed * ((COST_PER_TOKEN_INPUT + COST_PER_TOKEN_OUTPUT) / 2);
                return (
                  <tr key={agent.id}>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {agent.name}
                    </td>
                    <td>
                      <span className="badge badge-info">{agent.type}</span>
                    </td>
                    <td>
                      <span className={`badge ${agent.status === "running" ? "badge-success" : agent.status === "failed" ? "badge-error" : "badge-neutral"}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>{agent.tokensUsed.toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>{agent.tokenBudget.toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>${estCost.toFixed(6)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
