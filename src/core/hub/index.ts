// Sentinel Hub — community marketplace for skills, plugins, and templates

import { skillRegistry, type Skill } from "../skills";
import { BUILTIN_SKILLS, type BuiltinSkillDef } from "./builtin-skills";

export type HubCategory = "skills" | "plugins" | "templates" | "workflows";

export interface HubItem {
  id: string;
  name: string;
  description: string;
  category: HubCategory;
  author: string;
  version: string;
  tags: string[];
  rating: number;
  ratingCount: number;
  downloads: number;
  createdAt: Date;
  data: string; // JSON serialized content
}

// In-memory hub registry
const hubItems: Map<string, HubItem> = new Map();
const userRatings: Map<string, Map<string, number>> = new Map(); // itemId -> userId -> rating
let initialized = false;

export class SentinelHub {
  /**
   * Initialize hub with built-in starter items
   */
  async initialize(): Promise<void> {
    if (initialized) return;
    initialized = true;

    for (const builtin of BUILTIN_SKILLS) {
      const item: HubItem = {
        id: `builtin-${builtin.trigger.replace("/", "")}`,
        name: builtin.name,
        description: builtin.description,
        category: "skills",
        author: "OpenSentinel",
        version: "1.0.0",
        tags: builtin.tags,
        rating: 5.0,
        ratingCount: 0,
        downloads: 0,
        createdAt: new Date(),
        data: JSON.stringify({
          name: builtin.name,
          description: builtin.description,
          trigger: builtin.trigger,
          instructions: builtin.instructions,
          tools: builtin.tools,
          tags: builtin.tags,
        }),
      };
      hubItems.set(item.id, item);
    }
  }

  /**
   * Browse hub items with optional filtering
   */
  browseHub(params?: {
    category?: HubCategory;
    search?: string;
    tag?: string;
    limit?: number;
    offset?: number;
  }): { items: HubItem[]; total: number } {
    let items = [...hubItems.values()];

    if (params?.category) {
      items = items.filter((i) => i.category === params.category);
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (params?.tag) {
      const tag = params.tag.toLowerCase();
      items = items.filter((i) => i.tags.some((t) => t.toLowerCase() === tag));
    }

    // Sort by rating then downloads
    items.sort((a, b) => b.rating - a.rating || b.downloads - a.downloads);

    const total = items.length;
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 20;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  /**
   * Install a hub item (skill, plugin, template, etc.)
   */
  async installFromHub(
    itemId: string,
    userId: string
  ): Promise<{ success: boolean; message: string; skillId?: string }> {
    const item = hubItems.get(itemId);
    if (!item) {
      return { success: false, message: `Hub item not found: ${itemId}` };
    }

    item.downloads++;

    if (item.category === "skills") {
      const skill = skillRegistry.importSkill(item.data, userId);
      if (!skill) {
        return { success: false, message: "Failed to import skill data" };
      }
      return {
        success: true,
        message: `Installed skill "${item.name}" — use ${skill.trigger} to run it`,
        skillId: skill.id,
      };
    }

    // For plugins/templates/workflows — placeholder
    return {
      success: true,
      message: `Installed ${item.category} "${item.name}"`,
    };
  }

  /**
   * Publish a skill/plugin to the hub
   */
  async publishToHub(params: {
    name: string;
    description: string;
    category: HubCategory;
    data: string;
    author: string;
    tags?: string[];
    version?: string;
  }): Promise<{ success: boolean; itemId?: string; message: string }> {
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const item: HubItem = {
      id,
      name: params.name,
      description: params.description,
      category: params.category,
      author: params.author,
      version: params.version ?? "1.0.0",
      tags: params.tags ?? [],
      rating: 0,
      ratingCount: 0,
      downloads: 0,
      createdAt: new Date(),
      data: params.data,
    };

    hubItems.set(id, item);
    return { success: true, itemId: id, message: `Published "${params.name}" to Sentinel Hub` };
  }

  /**
   * Rate a hub item
   */
  rateItem(
    itemId: string,
    userId: string,
    rating: number
  ): { success: boolean; newRating?: number } {
    const item = hubItems.get(itemId);
    if (!item) return { success: false };

    rating = Math.max(1, Math.min(5, Math.round(rating)));

    if (!userRatings.has(itemId)) {
      userRatings.set(itemId, new Map());
    }

    const ratings = userRatings.get(itemId)!;
    const hadPrevious = ratings.has(userId);
    ratings.set(userId, rating);

    // Recalculate average
    let sum = 0;
    for (const r of ratings.values()) sum += r;
    item.rating = Math.round((sum / ratings.size) * 10) / 10;
    item.ratingCount = ratings.size;

    return { success: true, newRating: item.rating };
  }

  /**
   * Get a specific hub item
   */
  getItem(itemId: string): HubItem | undefined {
    return hubItems.get(itemId);
  }

  /**
   * Get hub statistics
   */
  getStats(): {
    totalItems: number;
    categories: Record<HubCategory, number>;
    totalDownloads: number;
  } {
    const stats = {
      totalItems: hubItems.size,
      categories: { skills: 0, plugins: 0, templates: 0, workflows: 0 } as Record<HubCategory, number>,
      totalDownloads: 0,
    };

    for (const item of hubItems.values()) {
      stats.categories[item.category]++;
      stats.totalDownloads += item.downloads;
    }

    return stats;
  }
}

// Singleton
export const sentinelHub = new SentinelHub();
