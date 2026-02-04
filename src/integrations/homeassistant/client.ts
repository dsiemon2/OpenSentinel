/**
 * Home Assistant REST API Client
 * Handles communication with Home Assistant's REST API
 */

export interface HomeAssistantConfig {
  url: string;
  token: string;
  timeout?: number;
}

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface HAService {
  domain: string;
  services: Record<string, HAServiceInfo>;
}

export interface HAServiceInfo {
  name?: string;
  description?: string;
  fields?: Record<string, HAServiceField>;
  target?: {
    entity?: { domain?: string[] };
    device?: { integration?: string[] };
    area?: Record<string, unknown>;
  };
}

export interface HAServiceField {
  name?: string;
  description?: string;
  required?: boolean;
  example?: unknown;
  selector?: Record<string, unknown>;
}

export interface HAEvent {
  event_type: string;
  listener_count: number;
}

export interface HAConfig {
  components: string[];
  config_dir: string;
  elevation: number;
  latitude: number;
  longitude: number;
  location_name: string;
  time_zone: string;
  unit_system: {
    length: string;
    mass: string;
    temperature: string;
    volume: string;
  };
  version: string;
  allowlist_external_dirs: string[];
  allowlist_external_urls: string[];
  currency: string;
  country: string;
  language: string;
}

export interface HALogbookEntry {
  when: string;
  name: string;
  message: string;
  entity_id?: string;
  domain?: string;
  context_user_id?: string;
}

export interface HAHistoryEntry {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HAError {
  code: string;
  message: string;
}

export class HomeAssistantClientError extends Error {
  public readonly statusCode?: number;
  public readonly haError?: HAError;

  constructor(message: string, statusCode?: number, haError?: HAError) {
    super(message);
    this.name = "HomeAssistantClientError";
    this.statusCode = statusCode;
    this.haError = haError;
  }
}

/**
 * Home Assistant REST API Client
 */
export class HomeAssistantClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeout: number;

  constructor(config: HomeAssistantConfig) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.token = config.token;
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Make an authenticated request to Home Assistant
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let haError: HAError | undefined;
        try {
          haError = await response.json();
        } catch {
          // Response might not be JSON
        }
        throw new HomeAssistantClientError(
          `Home Assistant API error: ${response.status} ${response.statusText}`,
          response.status,
          haError
        );
      }

      // Some endpoints return empty responses
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof HomeAssistantClientError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new HomeAssistantClientError(
            `Request timed out after ${this.timeout}ms`
          );
        }
        throw new HomeAssistantClientError(error.message);
      }
      throw new HomeAssistantClientError("Unknown error occurred");
    }
  }

  /**
   * Check if Home Assistant is running and accessible
   */
  async checkApi(): Promise<{ message: string }> {
    return this.request<{ message: string }>("GET", "/");
  }

  /**
   * Get Home Assistant configuration
   */
  async getConfig(): Promise<HAConfig> {
    return this.request<HAConfig>("GET", "/config");
  }

  /**
   * Get all entity states
   */
  async getStates(): Promise<HAState[]> {
    return this.request<HAState[]>("GET", "/states");
  }

  /**
   * Get a specific entity state
   */
  async getState(entityId: string): Promise<HAState> {
    return this.request<HAState>("GET", `/states/${entityId}`);
  }

  /**
   * Set an entity state (for setting up fake entities, etc.)
   */
  async setState(
    entityId: string,
    state: string,
    attributes?: Record<string, unknown>
  ): Promise<HAState> {
    return this.request<HAState>("POST", `/states/${entityId}`, {
      state,
      attributes,
    });
  }

  /**
   * Get all available services
   */
  async getServices(): Promise<HAService[]> {
    return this.request<HAService[]>("GET", "/services");
  }

  /**
   * Call a service
   */
  async callService<T = unknown>(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<T[]> {
    return this.request<T[]>("POST", `/services/${domain}/${service}`, data);
  }

  /**
   * Fire an event
   */
  async fireEvent(
    eventType: string,
    eventData?: Record<string, unknown>
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      "POST",
      `/events/${eventType}`,
      eventData
    );
  }

  /**
   * Get all event listeners
   */
  async getEvents(): Promise<HAEvent[]> {
    return this.request<HAEvent[]>("GET", "/events");
  }

  /**
   * Get logbook entries
   */
  async getLogbook(
    timestamp?: string,
    entityId?: string,
    endTime?: string
  ): Promise<HALogbookEntry[]> {
    const params = new URLSearchParams();
    if (entityId) params.set("entity", entityId);
    if (endTime) params.set("end_time", endTime);

    const query = params.toString();
    const endpoint = timestamp
      ? `/logbook/${timestamp}${query ? `?${query}` : ""}`
      : `/logbook${query ? `?${query}` : ""}`;

    return this.request<HALogbookEntry[]>("GET", endpoint);
  }

  /**
   * Get history for entities
   */
  async getHistory(
    timestamp: string,
    entityIds?: string[],
    endTime?: string,
    minimalResponse?: boolean,
    significantChangesOnly?: boolean
  ): Promise<HAHistoryEntry[][]> {
    const params = new URLSearchParams();
    if (entityIds && entityIds.length > 0) {
      params.set("filter_entity_id", entityIds.join(","));
    }
    if (endTime) params.set("end_time", endTime);
    if (minimalResponse) params.set("minimal_response", "true");
    if (significantChangesOnly) params.set("significant_changes_only", "true");

    const query = params.toString();
    const endpoint = `/history/period/${timestamp}${query ? `?${query}` : ""}`;

    return this.request<HAHistoryEntry[][]>("GET", endpoint);
  }

  /**
   * Get error log
   */
  async getErrorLog(): Promise<string> {
    return this.request<string>("GET", "/error_log");
  }

  /**
   * Get camera proxy image
   */
  async getCameraProxyImage(entityId: string): Promise<ArrayBuffer> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/camera_proxy/${entityId}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HomeAssistantClientError(
          `Failed to get camera image: ${response.status}`,
          response.status
        );
      }

      return response.arrayBuffer();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof HomeAssistantClientError) {
        throw error;
      }
      throw new HomeAssistantClientError(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Render a template
   */
  async renderTemplate(template: string): Promise<string> {
    const result = await this.request<string>("POST", "/template", { template });
    return result;
  }

  /**
   * Check if the connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.checkApi();
      return result.message === "API running.";
    } catch {
      return false;
    }
  }
}

/**
 * Create a Home Assistant client instance
 */
export function createClient(config: HomeAssistantConfig): HomeAssistantClient {
  return new HomeAssistantClient(config);
}

export default HomeAssistantClient;
