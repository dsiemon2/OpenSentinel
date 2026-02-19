import { useState, useEffect } from "react";

interface EntityNode {
  id: string;
  name: string;
  type: string;
  importance: number;
  description?: string;
  attributes?: Record<string, unknown>;
  aliases?: string[];
}

interface Relationship {
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  type: string;
  strength: number;
  description?: string;
}

interface EntityDetailPanelProps {
  entity: EntityNode | null;
  onClose: () => void;
  onEnrich: (entityId: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  organization: "#10b981",
  committee: "#f59e0b",
  contract: "#ef4444",
  filing: "#8b5cf6",
  location: "#06b6d4",
  topic: "#ec4899",
};

const IDENTIFIER_KEYS = ["ein", "cik", "fec_id", "uei", "duns", "fecId"];

export default function EntityDetailPanel({
  entity,
  onClose,
  onEnrich,
}: EntityDetailPanelProps) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    if (!entity) {
      setRelationships([]);
      return;
    }
    fetchRelationships(entity.id);
  }, [entity?.id]);

  const fetchRelationships = async (entityId: string) => {
    setLoadingRelationships(true);
    try {
      const response = await fetch(`/api/osint/entity/${entityId}`);
      if (response.ok) {
        const data = await response.json();
        const rels = data.relationships || {};
        // Normalize outgoing relationships (have targetName)
        const outgoing = (rels.outgoing || []).map((r: any) => ({
          id: r.id,
          sourceId: r.sourceEntityId,
          sourceName: entity?.name || "",
          targetId: r.targetEntityId,
          targetName: r.targetName || "Unknown",
          type: r.type,
          strength: (r.strength ?? 50) / 100,
          description: r.context,
        }));
        // Normalize incoming relationships (have sourceName)
        const incoming = (rels.incoming || []).map((r: any) => ({
          id: r.id,
          sourceId: r.sourceEntityId,
          sourceName: r.sourceName || "Unknown",
          targetId: r.targetEntityId,
          targetName: entity?.name || "",
          type: r.type,
          strength: (r.strength ?? 50) / 100,
          description: r.context,
        }));
        setRelationships([...outgoing, ...incoming]);
      }
    } catch (error) {
      console.error("Error fetching entity relationships:", error);
    } finally {
      setLoadingRelationships(false);
    }
  };

  const handleEnrich = async () => {
    if (!entity) return;
    setEnriching(true);
    try {
      await onEnrich(entity.id);
    } finally {
      setEnriching(false);
    }
  };

  if (!entity) return null;

  const typeColor = TYPE_COLORS[entity.type] || "#6b7280";

  const identifiers: { key: string; value: unknown }[] = [];
  const otherAttributes: { key: string; value: unknown }[] = [];
  const sources: unknown[] = [];

  if (entity.attributes) {
    for (const [key, value] of Object.entries(entity.attributes)) {
      if (key === "sources" && Array.isArray(value)) {
        sources.push(...value);
      } else if (
        IDENTIFIER_KEYS.includes(key) ||
        IDENTIFIER_KEYS.includes(key.toLowerCase())
      ) {
        identifiers.push({ key, value });
      } else {
        otherAttributes.push({ key, value });
      }
    }
  }

  const incomingRelationships = relationships.filter(
    (r) => r.targetId === entity.id
  );
  const outgoingRelationships = relationships.filter(
    (r) => r.sourceId === entity.id
  );

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h3 style={styles.entityName}>{entity.name}</h3>
          <button onClick={onClose} style={styles.closeButton}>
            &times;
          </button>
        </div>
        <div style={styles.badgeRow}>
          <span
            style={{
              ...styles.typeBadge,
              backgroundColor: typeColor + "22",
              color: typeColor,
              borderColor: typeColor + "44",
            }}
          >
            {entity.type}
          </span>
          <span style={styles.importanceBadge}>
            Importance: {entity.importance}/100
          </span>
        </div>
      </div>

      {/* Description */}
      {entity.description && (
        <div style={styles.section}>
          <p style={styles.description}>{entity.description}</p>
        </div>
      )}

      {/* Identifiers */}
      {identifiers.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Identifiers</h4>
          <div style={styles.attributeList}>
            {identifiers.map(({ key, value }) => (
              <div key={key} style={styles.attributeRow}>
                <span style={styles.attributeKey}>
                  {key.toUpperCase().replace("_", " ")}
                </span>
                <span style={styles.attributeValue}>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Attributes */}
      {otherAttributes.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Attributes</h4>
          <div style={styles.attributeList}>
            {otherAttributes.map(({ key, value }) => (
              <div key={key} style={styles.attributeRow}>
                <span style={styles.attributeKey}>{key}</span>
                <span style={styles.attributeValue}>
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aliases */}
      {entity.aliases && entity.aliases.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Aliases</h4>
          <div style={styles.aliasList}>
            {entity.aliases.map((alias, i) => (
              <span key={i} style={styles.aliasTag}>
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Sources</h4>
          <div style={styles.sourceList}>
            {sources.map((source, i) => (
              <div key={i} style={styles.sourceItem}>
                {typeof source === "object" && source !== null ? (
                  <>
                    <span style={styles.sourceType}>
                      {(source as Record<string, unknown>).type
                        ? String((source as Record<string, unknown>).type)
                        : "source"}
                    </span>
                    {(source as Record<string, unknown>).url ? (
                      <a
                        href={String((source as Record<string, unknown>).url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.sourceLink}
                      >
                        {String(
                          (source as Record<string, unknown>).name ||
                            (source as Record<string, unknown>).url
                        )}
                      </a>
                    ) : (
                      <span style={styles.sourceText}>
                        {String(
                          (source as Record<string, unknown>).name ||
                            JSON.stringify(source)
                        )}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={styles.sourceText}>{String(source)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Relationships</h4>
        {loadingRelationships ? (
          <p style={styles.loadingText}>Loading relationships...</p>
        ) : relationships.length === 0 ? (
          <p style={styles.emptyText}>No relationships found.</p>
        ) : (
          <>
            {outgoingRelationships.length > 0 && (
              <div style={styles.relationshipGroup}>
                <span style={styles.relationshipDirection}>Outgoing</span>
                {outgoingRelationships.map((rel) => (
                  <div key={rel.id} style={styles.relationshipItem}>
                    <span style={styles.relationshipType}>{rel.type}</span>
                    <span style={styles.relationshipArrow}>&rarr;</span>
                    <span style={styles.relationshipTarget}>
                      {rel.targetName}
                    </span>
                    <span style={styles.relationshipStrength}>
                      ({(rel.strength * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
            {incomingRelationships.length > 0 && (
              <div style={styles.relationshipGroup}>
                <span style={styles.relationshipDirection}>Incoming</span>
                {incomingRelationships.map((rel) => (
                  <div key={rel.id} style={styles.relationshipItem}>
                    <span style={styles.relationshipTarget}>
                      {rel.sourceName}
                    </span>
                    <span style={styles.relationshipArrow}>&rarr;</span>
                    <span style={styles.relationshipType}>{rel.type}</span>
                    <span style={styles.relationshipStrength}>
                      ({(rel.strength * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Enrich Button */}
      <div style={styles.footer}>
        <button
          onClick={handleEnrich}
          disabled={enriching}
          style={{
            ...styles.enrichButton,
            opacity: enriching ? 0.6 : 1,
            cursor: enriching ? "not-allowed" : "pointer",
          }}
        >
          {enriching ? "Enriching..." : "Enrich Entity"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 360,
    height: "100%",
    backgroundColor: "#111827",
    borderLeft: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: "16px 16px 12px",
    borderBottom: "1px solid #1f2937",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  entityName: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#f9fafb",
    lineHeight: 1.3,
    wordBreak: "break-word",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "#9ca3af",
    fontSize: 22,
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
    flexShrink: 0,
  },
  badgeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  typeBadge: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "capitalize" as const,
    border: "1px solid",
  },
  importanceBadge: {
    fontSize: 12,
    color: "#9ca3af",
  },
  section: {
    padding: "12px 16px",
    borderBottom: "1px solid #1f2937",
    overflowY: "auto" as const,
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: 13,
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  description: {
    margin: 0,
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 1.5,
  },
  attributeList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  attributeRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  attributeKey: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: 500,
    flexShrink: 0,
  },
  attributeValue: {
    fontSize: 13,
    color: "#e5e7eb",
    fontFamily: "monospace",
    textAlign: "right" as const,
    wordBreak: "break-all" as const,
  },
  aliasList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  aliasTag: {
    display: "inline-block",
    padding: "2px 8px",
    backgroundColor: "#1f2937",
    borderRadius: 6,
    fontSize: 12,
    color: "#d1d5db",
  },
  sourceList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  sourceItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
  },
  sourceType: {
    padding: "1px 6px",
    backgroundColor: "#1f2937",
    borderRadius: 4,
    fontSize: 11,
    color: "#9ca3af",
    textTransform: "uppercase" as const,
    flexShrink: 0,
  },
  sourceLink: {
    color: "#60a5fa",
    textDecoration: "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sourceText: {
    color: "#d1d5db",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  loadingText: {
    margin: 0,
    fontSize: 13,
    color: "#6b7280",
    fontStyle: "italic",
  },
  emptyText: {
    margin: 0,
    fontSize: 13,
    color: "#6b7280",
  },
  relationshipGroup: {
    marginBottom: 10,
  },
  relationshipDirection: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    marginBottom: 4,
    letterSpacing: "0.05em",
  },
  relationshipItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 0",
    fontSize: 13,
  },
  relationshipType: {
    padding: "1px 6px",
    backgroundColor: "#1f2937",
    borderRadius: 4,
    fontSize: 11,
    color: "#d1d5db",
    flexShrink: 0,
  },
  relationshipArrow: {
    color: "#6b7280",
    flexShrink: 0,
  },
  relationshipTarget: {
    color: "#e5e7eb",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  relationshipStrength: {
    color: "#6b7280",
    fontSize: 11,
    flexShrink: 0,
  },
  footer: {
    padding: 16,
    marginTop: "auto",
  },
  enrichButton: {
    width: "100%",
    padding: "10px 16px",
    backgroundColor: "#10b981",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    transition: "opacity 0.15s",
  },
};
