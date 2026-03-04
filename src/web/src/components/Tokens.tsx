import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface BrainScores {
  costSummary: {
    totalCost: number;
    costByTier: Record<string, number>;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
    estimatedMonthlyCost: number;
  };
  pipelineMetrics: {
    totalRequests: number;
  };
}

interface MetricsOverview {
  last24h?: { inputTokens?: number; outputTokens?: number; requests?: number };
  last7d?: { inputTokens?: number; outputTokens?: number; requests?: number };
}

export default function Tokens() {
  const [scores, setScores] = useState<BrainScores | null>(null);
  const [overview, setOverview] = useState<MetricsOverview | null>(null);

  useEffect(() => {
    apiFetch("/api/brain/scores").then(r => r.json()).then(setScores).catch(() => {});
    apiFetch("/api/metrics/overview").then(r => r.json()).then(setOverview).catch(() => {});

    const interval = setInterval(() => {
      apiFetch("/api/brain/scores").then(r => r.json()).then(setScores).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const cost = scores?.costSummary;
  const totalTokens = (cost?.totalInputTokens ?? 0) + (cost?.totalOutputTokens ?? 0);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Token Usage</h2>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Input Tokens</div>
          <div className="stat-value">{(cost?.totalInputTokens ?? 0).toLocaleString()}</div>
          <div className="stat-subtitle">
            24h: {(overview?.last24h?.inputTokens ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Output Tokens</div>
          <div className="stat-value">{(cost?.totalOutputTokens ?? 0).toLocaleString()}</div>
          <div className="stat-subtitle">
            24h: {(overview?.last24h?.outputTokens ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Tokens</div>
          <div className="stat-value">{totalTokens.toLocaleString()}</div>
          <div className="stat-subtitle">
            7d: {((overview?.last7d?.inputTokens ?? 0) + (overview?.last7d?.outputTokens ?? 0)).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Requests</div>
          <div className="stat-value">{cost?.requestCount ?? 0}</div>
          <div className="stat-subtitle">
            24h: {overview?.last24h?.requests ?? 0}
          </div>
        </div>
      </div>

      {/* Token Distribution */}
      <div className="card">
        <h3>Token Distribution</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
          <div style={{ flex: 1, height: 24, background: "var(--bg-tertiary)", borderRadius: 12, overflow: "hidden", display: "flex" }}>
            {totalTokens > 0 && (
              <>
                <div style={{
                  width: `${((cost?.totalInputTokens ?? 0) / totalTokens) * 100}%`,
                  background: "#3b82f6", height: "100%",
                  transition: "width 0.3s",
                }} />
                <div style={{
                  width: `${((cost?.totalOutputTokens ?? 0) / totalTokens) * 100}%`,
                  background: "#10b981", height: "100%",
                  transition: "width 0.3s",
                }} />
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 8, fontSize: 12 }}>
          <span style={{ color: "#3b82f6" }}>Input: {totalTokens > 0 ? Math.round(((cost?.totalInputTokens ?? 0) / totalTokens) * 100) : 0}%</span>
          <span style={{ color: "#10b981" }}>Output: {totalTokens > 0 ? Math.round(((cost?.totalOutputTokens ?? 0) / totalTokens) * 100) : 0}%</span>
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
              </tr>
            </thead>
            <tbody>
              {Object.entries(cost.costByTier).map(([tier, amount]) => (
                <tr key={tier}>
                  <td>{tier}</td>
                  <td style={{ textAlign: "right" }}>${(amount as number).toFixed(6)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 600 }}>
                <td>Total</td>
                <td style={{ textAlign: "right" }}>${cost.totalCost.toFixed(6)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
