/**
 * Docs Writer — Auto-generate API refs, guides, changelogs, README sections
 *
 * Analyzes code/data to produce structured documentation.
 * Generates markdown for API references, changelogs, guides, and more.
 */

export interface DocResult {
  type: string;
  title: string;
  content: string;
  sections: string[];
  wordCount: number;
  generatedAt: Date;
}

export interface APIEndpoint {
  method: string;
  path: string;
  description?: string;
  params?: Array<{ name: string; type: string; required?: boolean; description?: string }>;
  body?: Array<{ name: string; type: string; required?: boolean; description?: string }>;
  response?: string;
  example?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: Array<{ type: "added" | "changed" | "fixed" | "removed" | "security" | "deprecated"; description: string }>;
}

export interface GuideSection {
  title: string;
  content: string;
}

/**
 * Generate an API reference document from endpoint definitions
 */
export function generateAPIRef(
  projectName: string,
  endpoints: APIEndpoint[],
  opts?: { baseUrl?: string; authInfo?: string }
): DocResult {
  const sections: string[] = [];
  let md = `# ${projectName} API Reference\n\n`;
  sections.push("header");

  if (opts?.baseUrl) {
    md += `**Base URL:** \`${opts.baseUrl}\`\n\n`;
  }

  if (opts?.authInfo) {
    md += `## Authentication\n\n${opts.authInfo}\n\n`;
    sections.push("authentication");
  }

  md += `## Endpoints\n\n`;
  md += `| Method | Path | Description |\n`;
  md += `|--------|------|-------------|\n`;
  for (const ep of endpoints) {
    md += `| \`${ep.method}\` | \`${ep.path}\` | ${ep.description || "-"} |\n`;
  }
  md += "\n";
  sections.push("endpoint-table");

  // Detailed endpoint docs
  for (const ep of endpoints) {
    md += `---\n\n### ${ep.method} ${ep.path}\n\n`;
    if (ep.description) md += `${ep.description}\n\n`;
    sections.push(`endpoint-${ep.method}-${ep.path}`);

    if (ep.params && ep.params.length > 0) {
      md += `**Parameters:**\n\n`;
      md += `| Name | Type | Required | Description |\n`;
      md += `|------|------|----------|-------------|\n`;
      for (const p of ep.params) {
        md += `| \`${p.name}\` | ${p.type} | ${p.required ? "Yes" : "No"} | ${p.description || "-"} |\n`;
      }
      md += "\n";
    }

    if (ep.body && ep.body.length > 0) {
      md += `**Request Body:**\n\n`;
      md += `| Field | Type | Required | Description |\n`;
      md += `|-------|------|----------|-------------|\n`;
      for (const b of ep.body) {
        md += `| \`${b.name}\` | ${b.type} | ${b.required ? "Yes" : "No"} | ${b.description || "-"} |\n`;
      }
      md += "\n";
    }

    if (ep.response) {
      md += `**Response:**\n\n\`\`\`json\n${ep.response}\n\`\`\`\n\n`;
    }

    if (ep.example) {
      md += `**Example:**\n\n\`\`\`bash\n${ep.example}\n\`\`\`\n\n`;
    }
  }

  return {
    type: "api_reference",
    title: `${projectName} API Reference`,
    content: md,
    sections,
    wordCount: md.split(/\s+/).length,
    generatedAt: new Date(),
  };
}

/**
 * Generate a changelog from entries
 */
export function generateChangelog(
  projectName: string,
  entries: ChangelogEntry[]
): DocResult {
  const sections: string[] = [];
  let md = `# ${projectName} Changelog\n\n`;
  md += `All notable changes to this project will be documented in this file.\n\n`;
  sections.push("header");

  const typeLabels: Record<string, string> = {
    added: "Added",
    changed: "Changed",
    fixed: "Fixed",
    removed: "Removed",
    security: "Security",
    deprecated: "Deprecated",
  };

  const typeEmojis: Record<string, string> = {
    added: "+",
    changed: "~",
    fixed: "!",
    removed: "-",
    security: "!!",
    deprecated: "?",
  };

  // Sort entries by version (newest first)
  const sorted = [...entries].sort((a, b) => {
    const va = a.version.replace(/[^\d.]/g, "").split(".").map(Number);
    const vb = b.version.replace(/[^\d.]/g, "").split(".").map(Number);
    for (let i = 0; i < Math.max(va.length, vb.length); i++) {
      if ((vb[i] || 0) !== (va[i] || 0)) return (vb[i] || 0) - (va[i] || 0);
    }
    return 0;
  });

  for (const entry of sorted) {
    md += `## [${entry.version}] - ${entry.date}\n\n`;
    sections.push(`version-${entry.version}`);

    // Group by type
    const grouped = new Map<string, string[]>();
    for (const change of entry.changes) {
      if (!grouped.has(change.type)) grouped.set(change.type, []);
      grouped.get(change.type)!.push(change.description);
    }

    for (const [type, changes] of grouped) {
      md += `### ${typeLabels[type] || type}\n\n`;
      for (const change of changes) {
        md += `- ${change}\n`;
      }
      md += "\n";
    }
  }

  return {
    type: "changelog",
    title: `${projectName} Changelog`,
    content: md,
    sections,
    wordCount: md.split(/\s+/).length,
    generatedAt: new Date(),
  };
}

/**
 * Generate a getting started guide
 */
export function generateGuide(
  projectName: string,
  guideSections: GuideSection[],
  opts?: { prerequisites?: string[]; installCommand?: string }
): DocResult {
  const sections: string[] = [];
  let md = `# ${projectName} Getting Started Guide\n\n`;
  sections.push("header");

  if (opts?.prerequisites && opts.prerequisites.length > 0) {
    md += `## Prerequisites\n\n`;
    for (const p of opts.prerequisites) {
      md += `- ${p}\n`;
    }
    md += "\n";
    sections.push("prerequisites");
  }

  if (opts?.installCommand) {
    md += `## Installation\n\n`;
    md += `\`\`\`bash\n${opts.installCommand}\n\`\`\`\n\n`;
    sections.push("installation");
  }

  for (const section of guideSections) {
    md += `## ${section.title}\n\n${section.content}\n\n`;
    sections.push(section.title.toLowerCase().replace(/\s+/g, "-"));
  }

  return {
    type: "guide",
    title: `${projectName} Getting Started Guide`,
    content: md,
    sections,
    wordCount: md.split(/\s+/).length,
    generatedAt: new Date(),
  };
}

/**
 * Generate a README section from project metadata
 */
export function generateReadme(
  projectName: string,
  opts: {
    description?: string;
    features?: string[];
    installCommand?: string;
    usage?: string;
    license?: string;
    badges?: Array<{ label: string; url: string }>;
  }
): DocResult {
  const sections: string[] = [];
  let md = `# ${projectName}\n\n`;
  sections.push("header");

  if (opts.badges && opts.badges.length > 0) {
    md += opts.badges.map((b) => `![${b.label}](${b.url})`).join(" ") + "\n\n";
    sections.push("badges");
  }

  if (opts.description) {
    md += `${opts.description}\n\n`;
    sections.push("description");
  }

  if (opts.features && opts.features.length > 0) {
    md += `## Features\n\n`;
    for (const f of opts.features) {
      md += `- ${f}\n`;
    }
    md += "\n";
    sections.push("features");
  }

  if (opts.installCommand) {
    md += `## Installation\n\n\`\`\`bash\n${opts.installCommand}\n\`\`\`\n\n`;
    sections.push("installation");
  }

  if (opts.usage) {
    md += `## Usage\n\n${opts.usage}\n\n`;
    sections.push("usage");
  }

  if (opts.license) {
    md += `## License\n\n${opts.license}\n\n`;
    sections.push("license");
  }

  return {
    type: "readme",
    title: projectName,
    content: md,
    sections,
    wordCount: md.split(/\s+/).length,
    generatedAt: new Date(),
  };
}

/**
 * Auto-document TypeScript interfaces from source code
 */
export function documentInterfaces(sourceCode: string): DocResult {
  const sections: string[] = [];
  let md = `# Type Definitions\n\n`;
  sections.push("header");

  // Extract interfaces
  const interfacePattern = /(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+interface\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  while ((match = interfacePattern.exec(sourceCode)) !== null) {
    const name = match[1];
    const body = match[2];
    md += `## \`${name}\`\n\n`;
    md += `| Property | Type | Description |\n`;
    md += `|----------|------|-------------|\n`;
    sections.push(`interface-${name}`);

    // Parse properties
    const propPattern = /(\w+)\??\s*:\s*([^;]+)/g;
    let propMatch;
    while ((propMatch = propPattern.exec(body)) !== null) {
      const propName = propMatch[1];
      const propType = propMatch[2].trim();
      // Try to find inline comment
      const commentMatch = propMatch[0].match(/\/\/\s*(.+)/);
      const desc = commentMatch ? commentMatch[1] : "-";
      md += `| \`${propName}\` | \`${propType.replace(/\/\/.*/, "").trim()}\` | ${desc} |\n`;
    }
    md += "\n";
  }

  // Extract type aliases
  const typePattern = /export\s+type\s+(\w+)\s*=\s*([^;]+)/g;
  while ((match = typePattern.exec(sourceCode)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    md += `## \`${name}\`\n\n\`\`\`typescript\ntype ${name} = ${value}\n\`\`\`\n\n`;
    sections.push(`type-${name}`);
  }

  if (sections.length === 1) {
    md += "*No interfaces or types found in source.*\n";
  }

  return {
    type: "type_docs",
    title: "Type Definitions",
    content: md,
    sections,
    wordCount: md.split(/\s+/).length,
    generatedAt: new Date(),
  };
}
