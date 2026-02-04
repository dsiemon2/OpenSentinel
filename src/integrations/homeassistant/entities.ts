/**
 * Home Assistant Entity State Management
 * Handles entity state queries, filtering, and categorization
 */

import type { HomeAssistantClient, HAState } from "./client";

export interface EntityFilter {
  domains?: string[];
  entityIds?: string[];
  areas?: string[];
  deviceClasses?: string[];
  attributes?: Record<string, unknown>;
  stateFilter?: (state: string) => boolean;
}

export interface EntityGroup {
  domain: string;
  entities: HAState[];
}

export interface DeviceInfo {
  entityId: string;
  friendlyName: string;
  domain: string;
  state: string;
  attributes: Record<string, unknown>;
  isAvailable: boolean;
  lastChanged: Date;
  lastUpdated: Date;
}

export type EntityDomain =
  | "light"
  | "switch"
  | "cover"
  | "climate"
  | "scene"
  | "automation"
  | "script"
  | "sensor"
  | "binary_sensor"
  | "media_player"
  | "fan"
  | "lock"
  | "vacuum"
  | "camera"
  | "alarm_control_panel"
  | "input_boolean"
  | "input_number"
  | "input_select"
  | "input_text"
  | "input_datetime"
  | "person"
  | "zone"
  | "weather"
  | "sun"
  | "device_tracker"
  | "group";

/**
 * Entity State Manager for Home Assistant
 */
export class EntityManager {
  private client: HomeAssistantClient;
  private stateCache: Map<string, HAState> = new Map();
  private lastFetch: number = 0;
  private cacheTtl: number;

  constructor(client: HomeAssistantClient, cacheTtl: number = 5000) {
    this.client = client;
    this.cacheTtl = cacheTtl;
  }

  /**
   * Refresh the state cache
   */
  async refreshCache(): Promise<void> {
    const states = await this.client.getStates();
    this.stateCache.clear();
    for (const state of states) {
      this.stateCache.set(state.entity_id, state);
    }
    this.lastFetch = Date.now();
  }

  /**
   * Check if cache is stale
   */
  private isCacheStale(): boolean {
    return Date.now() - this.lastFetch > this.cacheTtl;
  }

  /**
   * Ensure cache is fresh
   */
  private async ensureFreshCache(): Promise<void> {
    if (this.isCacheStale() || this.stateCache.size === 0) {
      await this.refreshCache();
    }
  }

  /**
   * Get all entities
   */
  async getAllEntities(): Promise<HAState[]> {
    await this.ensureFreshCache();
    return Array.from(this.stateCache.values());
  }

  /**
   * Get entity by ID
   */
  async getEntity(entityId: string): Promise<HAState | null> {
    await this.ensureFreshCache();
    return this.stateCache.get(entityId) ?? null;
  }

  /**
   * Get entity directly from API (bypassing cache)
   */
  async getEntityFresh(entityId: string): Promise<HAState> {
    const state = await this.client.getState(entityId);
    this.stateCache.set(entityId, state);
    return state;
  }

  /**
   * Get entities filtered by criteria
   */
  async getEntities(filter: EntityFilter): Promise<HAState[]> {
    await this.ensureFreshCache();
    const entities = Array.from(this.stateCache.values());

    return entities.filter((entity) => {
      // Filter by domain
      if (filter.domains && filter.domains.length > 0) {
        const domain = entity.entity_id.split(".")[0];
        if (!filter.domains.includes(domain)) {
          return false;
        }
      }

      // Filter by entity IDs
      if (filter.entityIds && filter.entityIds.length > 0) {
        if (!filter.entityIds.includes(entity.entity_id)) {
          return false;
        }
      }

      // Filter by device class
      if (filter.deviceClasses && filter.deviceClasses.length > 0) {
        const deviceClass = entity.attributes.device_class as string | undefined;
        if (!deviceClass || !filter.deviceClasses.includes(deviceClass)) {
          return false;
        }
      }

      // Filter by attributes
      if (filter.attributes) {
        for (const [key, value] of Object.entries(filter.attributes)) {
          if (entity.attributes[key] !== value) {
            return false;
          }
        }
      }

      // Filter by state
      if (filter.stateFilter) {
        if (!filter.stateFilter(entity.state)) {
          return false;
        }
      }

      // Filter by area (if area_id attribute exists)
      if (filter.areas && filter.areas.length > 0) {
        const areaId = entity.attributes.area_id as string | undefined;
        if (!areaId || !filter.areas.includes(areaId)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get entities grouped by domain
   */
  async getEntitiesGroupedByDomain(): Promise<EntityGroup[]> {
    await this.ensureFreshCache();
    const groups = new Map<string, HAState[]>();

    for (const entity of Array.from(this.stateCache.values())) {
      const domain = entity.entity_id.split(".")[0];
      const existing = groups.get(domain) ?? [];
      existing.push(entity);
      groups.set(domain, existing);
    }

    return Array.from(groups.entries()).map(([domain, entities]) => ({
      domain,
      entities,
    }));
  }

  /**
   * Get all entities of a specific domain
   */
  async getEntitiesByDomain(domain: EntityDomain | string): Promise<HAState[]> {
    return this.getEntities({ domains: [domain] });
  }

  /**
   * Get all lights
   */
  async getLights(): Promise<HAState[]> {
    return this.getEntitiesByDomain("light");
  }

  /**
   * Get all switches
   */
  async getSwitches(): Promise<HAState[]> {
    return this.getEntitiesByDomain("switch");
  }

  /**
   * Get all covers (blinds, garage doors, etc.)
   */
  async getCovers(): Promise<HAState[]> {
    return this.getEntitiesByDomain("cover");
  }

  /**
   * Get all climate entities (thermostats, AC units)
   */
  async getClimate(): Promise<HAState[]> {
    return this.getEntitiesByDomain("climate");
  }

  /**
   * Get all sensors
   */
  async getSensors(): Promise<HAState[]> {
    return this.getEntitiesByDomain("sensor");
  }

  /**
   * Get all binary sensors
   */
  async getBinarySensors(): Promise<HAState[]> {
    return this.getEntitiesByDomain("binary_sensor");
  }

  /**
   * Get all media players
   */
  async getMediaPlayers(): Promise<HAState[]> {
    return this.getEntitiesByDomain("media_player");
  }

  /**
   * Get all automations
   */
  async getAutomations(): Promise<HAState[]> {
    return this.getEntitiesByDomain("automation");
  }

  /**
   * Get all scenes
   */
  async getScenes(): Promise<HAState[]> {
    return this.getEntitiesByDomain("scene");
  }

  /**
   * Get all scripts
   */
  async getScripts(): Promise<HAState[]> {
    return this.getEntitiesByDomain("script");
  }

  /**
   * Get all fans
   */
  async getFans(): Promise<HAState[]> {
    return this.getEntitiesByDomain("fan");
  }

  /**
   * Get all locks
   */
  async getLocks(): Promise<HAState[]> {
    return this.getEntitiesByDomain("lock");
  }

  /**
   * Get all vacuums
   */
  async getVacuums(): Promise<HAState[]> {
    return this.getEntitiesByDomain("vacuum");
  }

  /**
   * Get all cameras
   */
  async getCameras(): Promise<HAState[]> {
    return this.getEntitiesByDomain("camera");
  }

  /**
   * Get all alarm panels
   */
  async getAlarmPanels(): Promise<HAState[]> {
    return this.getEntitiesByDomain("alarm_control_panel");
  }

  /**
   * Get all persons (presence tracking)
   */
  async getPersons(): Promise<HAState[]> {
    return this.getEntitiesByDomain("person");
  }

  /**
   * Get weather entities
   */
  async getWeather(): Promise<HAState[]> {
    return this.getEntitiesByDomain("weather");
  }

  /**
   * Get entities that are currently on
   */
  async getOnEntities(): Promise<HAState[]> {
    return this.getEntities({
      stateFilter: (state) => state === "on",
    });
  }

  /**
   * Get entities that are currently off
   */
  async getOffEntities(): Promise<HAState[]> {
    return this.getEntities({
      stateFilter: (state) => state === "off",
    });
  }

  /**
   * Get unavailable entities
   */
  async getUnavailableEntities(): Promise<HAState[]> {
    return this.getEntities({
      stateFilter: (state) => state === "unavailable" || state === "unknown",
    });
  }

  /**
   * Convert HAState to a more friendly DeviceInfo format
   */
  toDeviceInfo(state: HAState): DeviceInfo {
    const friendlyName =
      (state.attributes.friendly_name as string) ?? state.entity_id;
    const domain = state.entity_id.split(".")[0];
    const isAvailable =
      state.state !== "unavailable" && state.state !== "unknown";

    return {
      entityId: state.entity_id,
      friendlyName,
      domain,
      state: state.state,
      attributes: state.attributes,
      isAvailable,
      lastChanged: new Date(state.last_changed),
      lastUpdated: new Date(state.last_updated),
    };
  }

  /**
   * Get all entities as DeviceInfo
   */
  async getAllDeviceInfo(): Promise<DeviceInfo[]> {
    const entities = await this.getAllEntities();
    return entities.map((e) => this.toDeviceInfo(e));
  }

  /**
   * Search entities by name (friendly_name or entity_id)
   */
  async searchEntities(query: string): Promise<HAState[]> {
    await this.ensureFreshCache();
    const lowerQuery = query.toLowerCase();

    return Array.from(this.stateCache.values()).filter((entity) => {
      const friendlyName = (
        entity.attributes.friendly_name as string | undefined
      )?.toLowerCase();
      const entityId = entity.entity_id.toLowerCase();

      return (
        entityId.includes(lowerQuery) ||
        (friendlyName && friendlyName.includes(lowerQuery))
      );
    });
  }

  /**
   * Get entity count by domain
   */
  async getEntityCounts(): Promise<Record<string, number>> {
    await this.ensureFreshCache();
    const counts: Record<string, number> = {};

    for (const entity of Array.from(this.stateCache.values())) {
      const domain = entity.entity_id.split(".")[0];
      counts[domain] = (counts[domain] ?? 0) + 1;
    }

    return counts;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.stateCache.clear();
    this.lastFetch = 0;
  }
}

/**
 * Create an entity manager instance
 */
export function createEntityManager(
  client: HomeAssistantClient,
  cacheTtl?: number
): EntityManager {
  return new EntityManager(client, cacheTtl);
}

export default EntityManager;
