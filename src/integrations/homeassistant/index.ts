/**
 * Home Assistant Integration for OpenSentinel
 *
 * Provides comprehensive integration with Home Assistant including:
 * - REST API client for state queries and service calls
 * - Entity state management with caching
 * - Service calls for controlling devices
 * - Automation, script, and scene management
 * - Real-time WebSocket updates
 * - Natural language device control
 */

import {
  HomeAssistantClient,
  createClient,
  type HomeAssistantConfig,
  type HAState,
  type HAConfig,
  type HAService,
  type HAEvent,
  HomeAssistantClientError,
} from "./client";

import {
  EntityManager,
  createEntityManager,
  type EntityFilter,
  type EntityGroup,
  type DeviceInfo,
  type EntityDomain,
} from "./entities";

import {
  ServiceManager,
  createServiceManager,
  type ServiceCallResult,
  type LightOptions,
  type ClimateOptions,
  type CoverOptions,
  type FanOptions,
  type MediaPlayerOptions,
  type VacuumOptions,
  type AlarmOptions,
} from "./services";

import {
  AutomationManager,
  createAutomationManager,
  type AutomationInfo,
  type ScriptInfo,
  type SceneInfo,
  type AutomationTriggerOptions,
  type ScriptRunOptions,
} from "./automations";

import {
  HomeAssistantWebSocket,
  createWebSocket,
  type WebSocketConfig,
  type HAStateChangedEvent,
  type HAWebSocketState,
  type HAEventData,
  type StateChangeHandler,
  type EventHandler,
} from "./websocket";

export interface HomeAssistantIntegrationConfig {
  url: string;
  token: string;
  enableWebSocket?: boolean;
  cacheTtl?: number;
  timeout?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface NaturalLanguageCommand {
  action:
    | "turn_on"
    | "turn_off"
    | "toggle"
    | "set"
    | "increase"
    | "decrease"
    | "activate"
    | "run"
    | "trigger"
    | "get_state"
    | "list";
  target?: string;
  domain?: EntityDomain | string;
  value?: number | string;
  attributes?: Record<string, unknown>;
}

export interface NaturalLanguageResult {
  success: boolean;
  message: string;
  entities?: HAState[];
  error?: string;
}

/**
 * Main Home Assistant Integration class
 * Provides a unified interface to all Home Assistant features
 */
export class HomeAssistant {
  public readonly client: HomeAssistantClient;
  public readonly entities: EntityManager;
  public readonly services: ServiceManager;
  public readonly automations: AutomationManager;
  public readonly websocket: HomeAssistantWebSocket | null;

  private config: HomeAssistantIntegrationConfig;

  constructor(config: HomeAssistantIntegrationConfig) {
    this.config = config;

    // Initialize REST client
    this.client = createClient({
      url: config.url,
      token: config.token,
      timeout: config.timeout,
    });

    // Initialize managers
    this.entities = createEntityManager(this.client, config.cacheTtl);
    this.services = createServiceManager(this.client);
    this.automations = createAutomationManager(
      this.client,
      this.entities,
      this.services
    );

    // Initialize WebSocket if enabled
    if (config.enableWebSocket !== false) {
      this.websocket = createWebSocket({
        url: config.url,
        token: config.token,
        reconnectInterval: config.reconnectInterval,
        maxReconnectAttempts: config.maxReconnectAttempts,
      });
    } else {
      this.websocket = null;
    }
  }

  /**
   * Connect to Home Assistant (verifies connection and optionally starts WebSocket)
   */
  async connect(): Promise<{ rest: boolean; websocket: boolean }> {
    const results = { rest: false, websocket: false };

    // Test REST API
    results.rest = await this.client.isHealthy();

    // Connect WebSocket if available
    if (this.websocket) {
      try {
        await this.websocket.connect();
        await this.websocket.subscribeToStateChanges();
        results.websocket = true;
      } catch {
        results.websocket = false;
      }
    }

    return results;
  }

  /**
   * Disconnect from Home Assistant
   */
  disconnect(): void {
    if (this.websocket) {
      this.websocket.disconnect();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): { rest: boolean; websocket: boolean } {
    return {
      rest: true, // REST is stateless
      websocket: this.websocket?.isConnected() ?? false,
    };
  }

  /**
   * Get Home Assistant configuration
   */
  async getConfig(): Promise<HAConfig> {
    return this.client.getConfig();
  }

  /**
   * Process a natural language command
   */
  async processCommand(command: NaturalLanguageCommand): Promise<NaturalLanguageResult> {
    try {
      switch (command.action) {
        case "turn_on":
          return this.handleTurnOn(command);
        case "turn_off":
          return this.handleTurnOff(command);
        case "toggle":
          return this.handleToggle(command);
        case "set":
          return this.handleSet(command);
        case "increase":
        case "decrease":
          return this.handleAdjust(command);
        case "activate":
          return this.handleActivate(command);
        case "run":
          return this.handleRun(command);
        case "trigger":
          return this.handleTrigger(command);
        case "get_state":
          return this.handleGetState(command);
        case "list":
          return this.handleList(command);
        default:
          return {
            success: false,
            message: "Unknown action",
            error: `Unsupported action: ${command.action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: "Command failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleTurnOn(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    const entities = await this.resolveTarget(command);
    if (entities.length === 0) {
      return {
        success: false,
        message: "No matching entities found",
      };
    }

    const entityIds = entities.map((e) => e.entity_id);
    const result = await this.services.turnOn(entityIds);

    return {
      success: result.success,
      message: result.success
        ? `Turned on ${entityIds.length} device(s)`
        : "Failed to turn on devices",
      entities,
      error: result.error,
    };
  }

  private async handleTurnOff(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    const entities = await this.resolveTarget(command);
    if (entities.length === 0) {
      return {
        success: false,
        message: "No matching entities found",
      };
    }

    const entityIds = entities.map((e) => e.entity_id);
    const result = await this.services.turnOff(entityIds);

    return {
      success: result.success,
      message: result.success
        ? `Turned off ${entityIds.length} device(s)`
        : "Failed to turn off devices",
      entities,
      error: result.error,
    };
  }

  private async handleToggle(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    const entities = await this.resolveTarget(command);
    if (entities.length === 0) {
      return {
        success: false,
        message: "No matching entities found",
      };
    }

    const entityIds = entities.map((e) => e.entity_id);
    const result = await this.services.toggle(entityIds);

    return {
      success: result.success,
      message: result.success
        ? `Toggled ${entityIds.length} device(s)`
        : "Failed to toggle devices",
      entities,
      error: result.error,
    };
  }

  private async handleSet(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    const entities = await this.resolveTarget(command);
    if (entities.length === 0) {
      return {
        success: false,
        message: "No matching entities found",
      };
    }

    const entityIds = entities.map((e) => e.entity_id);
    const domain = entities[0].entity_id.split(".")[0];
    let result: ServiceCallResult;

    switch (domain) {
      case "light":
        if (typeof command.value === "number") {
          result = await this.services.setLightBrightness(entityIds, command.value);
        } else {
          result = await this.services.turnOnLight(entityIds, command.attributes as LightOptions);
        }
        break;
      case "climate":
        if (typeof command.value === "number") {
          result = await this.services.setTemperature(entityIds, command.value);
        } else {
          result = await this.services.callService("climate", "set_temperature", {
            entity_id: entityIds,
            ...command.attributes,
          });
        }
        break;
      case "cover":
        if (typeof command.value === "number") {
          result = await this.services.setCoverPosition(entityIds, command.value);
        } else {
          result = { success: false, error: "Cover position must be a number" };
        }
        break;
      case "fan":
        if (typeof command.value === "number") {
          result = await this.services.setFanPercentage(entityIds, command.value);
        } else {
          result = { success: false, error: "Fan speed must be a number" };
        }
        break;
      case "media_player":
        if (typeof command.value === "number") {
          result = await this.services.setMediaVolume(entityIds, command.value / 100);
        } else {
          result = { success: false, error: "Volume must be a number" };
        }
        break;
      default:
        result = { success: false, error: `Cannot set value for domain: ${domain}` };
    }

    return {
      success: result.success,
      message: result.success
        ? `Set ${entityIds.length} device(s) to ${command.value}`
        : "Failed to set value",
      entities,
      error: result.error,
    };
  }

  private async handleAdjust(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    const entities = await this.resolveTarget(command);
    if (entities.length === 0) {
      return {
        success: false,
        message: "No matching entities found",
      };
    }

    const entity = entities[0];
    const domain = entity.entity_id.split(".")[0];
    const amount = (typeof command.value === "number" ? command.value : 10) *
      (command.action === "decrease" ? -1 : 1);

    let result: ServiceCallResult;
    let newValue: number;

    switch (domain) {
      case "light": {
        const currentBrightness =
          (entity.attributes.brightness as number | undefined) ?? 127;
        const currentPercent = Math.round((currentBrightness / 255) * 100);
        newValue = Math.max(0, Math.min(100, currentPercent + amount));
        result = await this.services.setLightBrightness(entity.entity_id, newValue);
        break;
      }
      case "climate": {
        const currentTemp = entity.attributes.temperature as number | undefined;
        if (currentTemp === undefined) {
          return {
            success: false,
            message: "Could not determine current temperature",
          };
        }
        newValue = currentTemp + amount;
        result = await this.services.setTemperature(entity.entity_id, newValue);
        break;
      }
      case "fan": {
        const currentPercent =
          (entity.attributes.percentage as number | undefined) ?? 50;
        newValue = Math.max(0, Math.min(100, currentPercent + amount));
        result = await this.services.setFanPercentage(entity.entity_id, newValue);
        break;
      }
      case "media_player": {
        const currentVolume =
          ((entity.attributes.volume_level as number | undefined) ?? 0.5) * 100;
        newValue = Math.max(0, Math.min(100, currentVolume + amount));
        result = await this.services.setMediaVolume(entity.entity_id, newValue / 100);
        break;
      }
      default:
        return {
          success: false,
          message: `Cannot adjust ${domain} entities`,
        };
    }

    return {
      success: result.success,
      message: result.success
        ? `${command.action === "increase" ? "Increased" : "Decreased"} to ${newValue}`
        : "Failed to adjust",
      entities: [entity],
      error: result.error,
    };
  }

  private async handleActivate(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    if (!command.target) {
      return {
        success: false,
        message: "No scene specified",
      };
    }

    // Try to find a matching scene
    const scenes = await this.automations.searchScenes(command.target);
    if (scenes.length === 0) {
      return {
        success: false,
        message: `Scene "${command.target}" not found`,
      };
    }

    const result = await this.automations.activateScene(scenes[0].entityId);
    return {
      success: result.success,
      message: result.success
        ? `Activated scene: ${scenes[0].friendlyName}`
        : "Failed to activate scene",
      error: result.error,
    };
  }

  private async handleRun(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    if (!command.target) {
      return {
        success: false,
        message: "No script specified",
      };
    }

    // Try to find a matching script
    const scripts = await this.automations.searchScripts(command.target);
    if (scripts.length === 0) {
      return {
        success: false,
        message: `Script "${command.target}" not found`,
      };
    }

    const result = await this.automations.runScript(scripts[0].entityId);
    return {
      success: result.success,
      message: result.success
        ? `Running script: ${scripts[0].friendlyName}`
        : "Failed to run script",
      error: result.error,
    };
  }

  private async handleTrigger(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    if (!command.target) {
      return {
        success: false,
        message: "No automation specified",
      };
    }

    // Try to find a matching automation
    const automations = await this.automations.searchAutomations(command.target);
    if (automations.length === 0) {
      return {
        success: false,
        message: `Automation "${command.target}" not found`,
      };
    }

    const result = await this.automations.triggerAutomation(
      automations[0].entityId
    );
    return {
      success: result.success,
      message: result.success
        ? `Triggered automation: ${automations[0].friendlyName}`
        : "Failed to trigger automation",
      error: result.error,
    };
  }

  private async handleGetState(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    const entities = await this.resolveTarget(command);
    if (entities.length === 0) {
      return {
        success: false,
        message: "No matching entities found",
      };
    }

    const stateDescriptions = entities.map((e) => {
      const name = (e.attributes.friendly_name as string) ?? e.entity_id;
      return `${name}: ${e.state}`;
    });

    return {
      success: true,
      message: stateDescriptions.join("\n"),
      entities,
    };
  }

  private async handleList(
    command: NaturalLanguageCommand
  ): Promise<NaturalLanguageResult> {
    let entities: HAState[];

    if (command.domain) {
      entities = await this.entities.getEntitiesByDomain(command.domain);
    } else if (command.target) {
      entities = await this.entities.searchEntities(command.target);
    } else {
      entities = await this.entities.getAllEntities();
    }

    const names = entities.slice(0, 20).map((e) => {
      const name = (e.attributes.friendly_name as string) ?? e.entity_id;
      return `${name} (${e.state})`;
    });

    return {
      success: true,
      message:
        entities.length > 20
          ? `Found ${entities.length} entities. Showing first 20:\n${names.join("\n")}`
          : `Found ${entities.length} entities:\n${names.join("\n")}`,
      entities: entities.slice(0, 20),
    };
  }

  /**
   * Resolve command target to entities
   */
  private async resolveTarget(
    command: NaturalLanguageCommand
  ): Promise<HAState[]> {
    // If target is a specific entity ID
    if (command.target?.includes(".")) {
      const entity = await this.entities.getEntity(command.target);
      return entity ? [entity] : [];
    }

    // If domain is specified
    if (command.domain) {
      const domainEntities = await this.entities.getEntitiesByDomain(
        command.domain
      );
      if (command.target) {
        const search = command.target.toLowerCase();
        return domainEntities.filter((e) => {
          const name = (
            e.attributes.friendly_name as string | undefined
          )?.toLowerCase();
          return (
            e.entity_id.toLowerCase().includes(search) ||
            (name && name.includes(search))
          );
        });
      }
      return domainEntities;
    }

    // Search by target name
    if (command.target) {
      return this.entities.searchEntities(command.target);
    }

    return [];
  }

  /**
   * Parse natural language into a command
   * This is a simple parser - for production, consider using an LLM
   */
  parseNaturalLanguage(text: string): NaturalLanguageCommand | null {
    const lowerText = text.toLowerCase().trim();

    // Turn on patterns
    if (
      lowerText.startsWith("turn on ") ||
      lowerText.startsWith("switch on ") ||
      lowerText.startsWith("enable ")
    ) {
      const target = text.replace(/^(turn on |switch on |enable )/i, "").trim();
      return { action: "turn_on", target };
    }

    // Turn off patterns
    if (
      lowerText.startsWith("turn off ") ||
      lowerText.startsWith("switch off ") ||
      lowerText.startsWith("disable ")
    ) {
      const target = text.replace(/^(turn off |switch off |disable )/i, "").trim();
      return { action: "turn_off", target };
    }

    // Toggle patterns
    if (lowerText.startsWith("toggle ")) {
      const target = text.replace(/^toggle /i, "").trim();
      return { action: "toggle", target };
    }

    // Set patterns (e.g., "set living room light to 50%")
    const setMatch = lowerText.match(
      /^set (.+?) (?:to|at) (\d+)\s*(%|degrees?)?$/
    );
    if (setMatch) {
      return {
        action: "set",
        target: setMatch[1],
        value: parseInt(setMatch[2], 10),
      };
    }

    // Increase/decrease patterns
    const adjustMatch = lowerText.match(
      /^(increase|decrease|brighten|dim|raise|lower) (.+?)(?: by (\d+)(%)?)?$/
    );
    if (adjustMatch) {
      const action = ["increase", "brighten", "raise"].includes(adjustMatch[1])
        ? "increase"
        : "decrease";
      return {
        action: action as "increase" | "decrease",
        target: adjustMatch[2],
        value: adjustMatch[3] ? parseInt(adjustMatch[3], 10) : undefined,
      };
    }

    // Activate scene patterns
    if (
      lowerText.startsWith("activate ") ||
      lowerText.startsWith("start scene ")
    ) {
      const target = text.replace(/^(activate |start scene )/i, "").trim();
      return { action: "activate", target };
    }

    // Run script patterns
    if (lowerText.startsWith("run ") || lowerText.startsWith("execute ")) {
      const target = text.replace(/^(run |execute )/i, "").trim();
      return { action: "run", target };
    }

    // Trigger automation patterns
    if (lowerText.startsWith("trigger ")) {
      const target = text.replace(/^trigger /i, "").trim();
      return { action: "trigger", target };
    }

    // Get state patterns
    if (
      lowerText.startsWith("what is ") ||
      lowerText.startsWith("get ") ||
      lowerText.startsWith("check ") ||
      lowerText.startsWith("status of ")
    ) {
      const target = text
        .replace(/^(what is |get |check |status of )/i, "")
        .replace(/\?$/, "")
        .trim();
      return { action: "get_state", target };
    }

    // List patterns
    if (
      lowerText.startsWith("list ") ||
      lowerText.startsWith("show ") ||
      lowerText.startsWith("find ")
    ) {
      const rest = text.replace(/^(list |show |find )/i, "").trim();

      // Check for domain-specific lists
      const domains: EntityDomain[] = [
        "light",
        "switch",
        "cover",
        "climate",
        "sensor",
        "binary_sensor",
        "media_player",
        "fan",
        "lock",
        "vacuum",
        "camera",
        "automation",
        "script",
        "scene",
      ];

      for (const domain of domains) {
        if (rest.includes(domain) || rest.includes(`${domain}s`)) {
          return { action: "list", domain };
        }
      }

      return { action: "list", target: rest || undefined };
    }

    return null;
  }

  /**
   * Execute a natural language command string
   */
  async executeNaturalLanguage(text: string): Promise<NaturalLanguageResult> {
    const command = this.parseNaturalLanguage(text);
    if (!command) {
      return {
        success: false,
        message: "Could not understand the command",
        error: `Unrecognized command: ${text}`,
      };
    }

    return this.processCommand(command);
  }
}

/**
 * Create a Home Assistant integration instance
 */
export function createHomeAssistant(
  config: HomeAssistantIntegrationConfig
): HomeAssistant {
  return new HomeAssistant(config);
}

// Re-export types and classes
export {
  // Client
  HomeAssistantClient,
  createClient,
  HomeAssistantClientError,
  type HomeAssistantConfig,
  type HAState,
  type HAConfig,
  type HAService,
  type HAEvent,

  // Entities
  EntityManager,
  createEntityManager,
  type EntityFilter,
  type EntityGroup,
  type DeviceInfo,
  type EntityDomain,

  // Services
  ServiceManager,
  createServiceManager,
  type ServiceCallResult,
  type LightOptions,
  type ClimateOptions,
  type CoverOptions,
  type FanOptions,
  type MediaPlayerOptions,
  type VacuumOptions,
  type AlarmOptions,

  // Automations
  AutomationManager,
  createAutomationManager,
  type AutomationInfo,
  type ScriptInfo,
  type SceneInfo,
  type AutomationTriggerOptions,
  type ScriptRunOptions,

  // WebSocket
  HomeAssistantWebSocket,
  createWebSocket,
  type WebSocketConfig,
  type HAStateChangedEvent,
  type HAWebSocketState,
  type HAEventData,
  type StateChangeHandler,
  type EventHandler,
};

export default HomeAssistant;
