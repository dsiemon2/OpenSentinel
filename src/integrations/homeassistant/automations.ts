/**
 * Home Assistant Automation Management
 * Handles triggering and managing automations, scripts, and scenes
 */

import type { HomeAssistantClient, HAState } from "./client";
import type { EntityManager } from "./entities";
import type { ServiceManager, ServiceCallResult } from "./services";

export interface AutomationInfo {
  entityId: string;
  friendlyName: string;
  state: "on" | "off";
  lastTriggered?: Date;
  mode?: "single" | "restart" | "queued" | "parallel";
  maxRuns?: number;
  currentRuns?: number;
}

export interface ScriptInfo {
  entityId: string;
  friendlyName: string;
  state: "on" | "off";
  lastTriggered?: Date;
  mode?: "single" | "restart" | "queued" | "parallel";
  maxRuns?: number;
  currentRuns?: number;
}

export interface SceneInfo {
  entityId: string;
  friendlyName: string;
  entities?: string[];
}

export interface AutomationTriggerOptions {
  skipCondition?: boolean;
  variables?: Record<string, unknown>;
}

export interface ScriptRunOptions {
  variables?: Record<string, unknown>;
}

/**
 * Automation Manager for Home Assistant
 */
export class AutomationManager {
  private client: HomeAssistantClient;
  private entityManager: EntityManager;
  private serviceManager: ServiceManager;

  constructor(
    client: HomeAssistantClient,
    entityManager: EntityManager,
    serviceManager: ServiceManager
  ) {
    this.client = client;
    this.entityManager = entityManager;
    this.serviceManager = serviceManager;
  }

  // ========== Automation Methods ==========

  /**
   * Get all automations
   */
  async getAutomations(): Promise<AutomationInfo[]> {
    const automations = await this.entityManager.getAutomations();
    return automations.map((a) => this.parseAutomationState(a));
  }

  /**
   * Get a specific automation
   */
  async getAutomation(entityId: string): Promise<AutomationInfo | null> {
    const state = await this.entityManager.getEntity(entityId);
    if (!state || !entityId.startsWith("automation.")) {
      return null;
    }
    return this.parseAutomationState(state);
  }

  /**
   * Parse automation state to AutomationInfo
   */
  private parseAutomationState(state: HAState): AutomationInfo {
    return {
      entityId: state.entity_id,
      friendlyName:
        (state.attributes.friendly_name as string) ?? state.entity_id,
      state: state.state as "on" | "off",
      lastTriggered: state.attributes.last_triggered
        ? new Date(state.attributes.last_triggered as string)
        : undefined,
      mode: state.attributes.mode as AutomationInfo["mode"],
      maxRuns: state.attributes.max as number | undefined,
      currentRuns: state.attributes.current as number | undefined,
    };
  }

  /**
   * Trigger an automation
   */
  async triggerAutomation(
    entityId: string,
    options?: AutomationTriggerOptions
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (options?.skipCondition) data.skip_condition = true;
    if (options?.variables) data.variables = options.variables;

    return this.serviceManager.callService("automation", "trigger", data);
  }

  /**
   * Enable an automation
   */
  async enableAutomation(
    entityId: string | string[]
  ): Promise<ServiceCallResult> {
    return this.serviceManager.callService("automation", "turn_on", {
      entity_id: entityId,
    });
  }

  /**
   * Disable an automation
   */
  async disableAutomation(
    entityId: string | string[]
  ): Promise<ServiceCallResult> {
    return this.serviceManager.callService("automation", "turn_off", {
      entity_id: entityId,
    });
  }

  /**
   * Toggle an automation
   */
  async toggleAutomation(
    entityId: string | string[]
  ): Promise<ServiceCallResult> {
    return this.serviceManager.callService("automation", "toggle", {
      entity_id: entityId,
    });
  }

  /**
   * Reload all automations
   */
  async reloadAutomations(): Promise<ServiceCallResult> {
    return this.serviceManager.callService("automation", "reload", {});
  }

  /**
   * Get enabled automations
   */
  async getEnabledAutomations(): Promise<AutomationInfo[]> {
    const automations = await this.getAutomations();
    return automations.filter((a) => a.state === "on");
  }

  /**
   * Get disabled automations
   */
  async getDisabledAutomations(): Promise<AutomationInfo[]> {
    const automations = await this.getAutomations();
    return automations.filter((a) => a.state === "off");
  }

  /**
   * Get recently triggered automations
   */
  async getRecentlyTriggeredAutomations(
    withinMinutes: number = 60
  ): Promise<AutomationInfo[]> {
    const automations = await this.getAutomations();
    const cutoff = Date.now() - withinMinutes * 60 * 1000;

    return automations.filter(
      (a) => a.lastTriggered && a.lastTriggered.getTime() > cutoff
    );
  }

  // ========== Script Methods ==========

  /**
   * Get all scripts
   */
  async getScripts(): Promise<ScriptInfo[]> {
    const scripts = await this.entityManager.getScripts();
    return scripts.map((s) => this.parseScriptState(s));
  }

  /**
   * Get a specific script
   */
  async getScript(entityId: string): Promise<ScriptInfo | null> {
    const state = await this.entityManager.getEntity(entityId);
    if (!state || !entityId.startsWith("script.")) {
      return null;
    }
    return this.parseScriptState(state);
  }

  /**
   * Parse script state to ScriptInfo
   */
  private parseScriptState(state: HAState): ScriptInfo {
    return {
      entityId: state.entity_id,
      friendlyName:
        (state.attributes.friendly_name as string) ?? state.entity_id,
      state: state.state as "on" | "off",
      lastTriggered: state.attributes.last_triggered
        ? new Date(state.attributes.last_triggered as string)
        : undefined,
      mode: state.attributes.mode as ScriptInfo["mode"],
      maxRuns: state.attributes.max as number | undefined,
      currentRuns: state.attributes.current as number | undefined,
    };
  }

  /**
   * Run a script
   */
  async runScript(
    entityId: string,
    options?: ScriptRunOptions
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = {};
    if (options?.variables) {
      Object.assign(data, options.variables);
    }

    // Script services are called using the script name (without 'script.' prefix)
    const scriptName = entityId.replace("script.", "");
    return this.serviceManager.callService("script", scriptName, data);
  }

  /**
   * Turn on a script (same as running it)
   */
  async turnOnScript(
    entityId: string,
    variables?: Record<string, unknown>
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (variables) {
      Object.assign(data, variables);
    }
    return this.serviceManager.callService("script", "turn_on", data);
  }

  /**
   * Turn off a running script
   */
  async turnOffScript(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.serviceManager.callService("script", "turn_off", {
      entity_id: entityId,
    });
  }

  /**
   * Toggle a script
   */
  async toggleScript(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.serviceManager.callService("script", "toggle", {
      entity_id: entityId,
    });
  }

  /**
   * Reload all scripts
   */
  async reloadScripts(): Promise<ServiceCallResult> {
    return this.serviceManager.callService("script", "reload", {});
  }

  /**
   * Get running scripts
   */
  async getRunningScripts(): Promise<ScriptInfo[]> {
    const scripts = await this.getScripts();
    return scripts.filter((s) => s.state === "on");
  }

  // ========== Scene Methods ==========

  /**
   * Get all scenes
   */
  async getScenes(): Promise<SceneInfo[]> {
    const scenes = await this.entityManager.getScenes();
    return scenes.map((s) => this.parseSceneState(s));
  }

  /**
   * Get a specific scene
   */
  async getScene(entityId: string): Promise<SceneInfo | null> {
    const state = await this.entityManager.getEntity(entityId);
    if (!state || !entityId.startsWith("scene.")) {
      return null;
    }
    return this.parseSceneState(state);
  }

  /**
   * Parse scene state to SceneInfo
   */
  private parseSceneState(state: HAState): SceneInfo {
    return {
      entityId: state.entity_id,
      friendlyName:
        (state.attributes.friendly_name as string) ?? state.entity_id,
      entities: state.attributes.entity_id as string[] | undefined,
    };
  }

  /**
   * Activate a scene
   */
  async activateScene(
    entityId: string,
    transition?: number
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (transition !== undefined) data.transition = transition;
    return this.serviceManager.callService("scene", "turn_on", data);
  }

  /**
   * Create a scene from current states
   */
  async createScene(
    sceneId: string,
    entities: string[],
    snapshotEntities?: string[]
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = {
      scene_id: sceneId,
      entities,
    };
    if (snapshotEntities) data.snapshot_entities = snapshotEntities;

    return this.serviceManager.callService("scene", "create", data);
  }

  /**
   * Apply a scene configuration
   */
  async applyScene(
    entities: Record<string, Record<string, unknown>>,
    transition?: number
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entities };
    if (transition !== undefined) data.transition = transition;

    return this.serviceManager.callService("scene", "apply", data);
  }

  /**
   * Reload all scenes
   */
  async reloadScenes(): Promise<ServiceCallResult> {
    return this.serviceManager.callService("scene", "reload", {});
  }

  // ========== Convenience Methods ==========

  /**
   * Search automations by name
   */
  async searchAutomations(query: string): Promise<AutomationInfo[]> {
    const automations = await this.getAutomations();
    const lowerQuery = query.toLowerCase();
    return automations.filter(
      (a) =>
        a.friendlyName.toLowerCase().includes(lowerQuery) ||
        a.entityId.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Search scripts by name
   */
  async searchScripts(query: string): Promise<ScriptInfo[]> {
    const scripts = await this.getScripts();
    const lowerQuery = query.toLowerCase();
    return scripts.filter(
      (s) =>
        s.friendlyName.toLowerCase().includes(lowerQuery) ||
        s.entityId.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Search scenes by name
   */
  async searchScenes(query: string): Promise<SceneInfo[]> {
    const scenes = await this.getScenes();
    const lowerQuery = query.toLowerCase();
    return scenes.filter(
      (s) =>
        s.friendlyName.toLowerCase().includes(lowerQuery) ||
        s.entityId.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Reload all configuration (automations, scripts, scenes)
   */
  async reloadAll(): Promise<{
    automations: ServiceCallResult;
    scripts: ServiceCallResult;
    scenes: ServiceCallResult;
  }> {
    const [automations, scripts, scenes] = await Promise.all([
      this.reloadAutomations(),
      this.reloadScripts(),
      this.reloadScenes(),
    ]);

    return { automations, scripts, scenes };
  }

  /**
   * Fire a custom event
   */
  async fireEvent(
    eventType: string,
    eventData?: Record<string, unknown>
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const result = await this.client.fireEvent(eventType, eventData);
      return { success: true, message: result.message };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Call homeassistant.reload_all to reload everything
   */
  async reloadHomeAssistant(): Promise<ServiceCallResult> {
    return this.serviceManager.callService("homeassistant", "reload_all", {});
  }

  /**
   * Restart Home Assistant
   */
  async restartHomeAssistant(): Promise<ServiceCallResult> {
    return this.serviceManager.callService("homeassistant", "restart", {});
  }

  /**
   * Stop Home Assistant
   */
  async stopHomeAssistant(): Promise<ServiceCallResult> {
    return this.serviceManager.callService("homeassistant", "stop", {});
  }

  /**
   * Check Home Assistant configuration
   */
  async checkConfig(): Promise<ServiceCallResult> {
    return this.serviceManager.callService("homeassistant", "check_config", {});
  }
}

/**
 * Create an automation manager instance
 */
export function createAutomationManager(
  client: HomeAssistantClient,
  entityManager: EntityManager,
  serviceManager: ServiceManager
): AutomationManager {
  return new AutomationManager(client, entityManager, serviceManager);
}

export default AutomationManager;
