/**
 * Home Assistant Service Calls
 * Provides high-level functions for calling Home Assistant services
 */

import type { HomeAssistantClient, HAState } from "./client";

export interface ServiceCallResult {
  success: boolean;
  affectedEntities?: HAState[];
  error?: string;
}

export interface LightOptions {
  brightness?: number; // 0-255
  brightnessPercent?: number; // 0-100
  colorTemp?: number; // Color temperature in mireds
  kelvin?: number; // Color temperature in Kelvin
  rgbColor?: [number, number, number]; // RGB values
  hsColor?: [number, number]; // Hue and saturation
  xyColor?: [number, number]; // CIE xy color
  transition?: number; // Transition time in seconds
  effect?: string; // Light effect
  flash?: "short" | "long";
  colorName?: string; // Named color
}

export interface ClimateOptions {
  temperature?: number;
  targetTempHigh?: number;
  targetTempLow?: number;
  hvacMode?: "heat" | "cool" | "heat_cool" | "auto" | "dry" | "fan_only" | "off";
  fanMode?: string;
  swingMode?: string;
  presetMode?: string;
  humidity?: number;
}

export interface CoverOptions {
  position?: number; // 0-100
  tiltPosition?: number; // 0-100
}

export interface FanOptions {
  speed?: string;
  percentage?: number; // 0-100
  direction?: "forward" | "reverse";
  oscillating?: boolean;
  presetMode?: string;
}

export interface MediaPlayerOptions {
  source?: string;
  mediaContentId?: string;
  mediaContentType?: string;
  volume?: number; // 0-1
  seekPosition?: number;
  announce?: boolean;
}

export interface VacuumOptions {
  fanSpeed?: string;
}

export interface AlarmOptions {
  code?: string;
}

/**
 * Home Assistant Service Manager
 */
export class ServiceManager {
  private client: HomeAssistantClient;

  constructor(client: HomeAssistantClient) {
    this.client = client;
  }

  /**
   * Generic service call wrapper
   */
  async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<ServiceCallResult> {
    try {
      const result = await this.client.callService<HAState>(domain, service, data);
      return {
        success: true,
        affectedEntities: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Call a service on specific entities
   */
  async callServiceOnEntities(
    domain: string,
    service: string,
    entityIds: string | string[],
    additionalData?: Record<string, unknown>
  ): Promise<ServiceCallResult> {
    const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
    return this.callService(domain, service, {
      entity_id: ids,
      ...additionalData,
    });
  }

  // ========== Light Services ==========

  /**
   * Turn on a light
   */
  async turnOnLight(
    entityId: string | string[],
    options?: LightOptions
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = {
      entity_id: entityId,
    };

    if (options) {
      if (options.brightness !== undefined) data.brightness = options.brightness;
      if (options.brightnessPercent !== undefined)
        data.brightness_pct = options.brightnessPercent;
      if (options.colorTemp !== undefined) data.color_temp = options.colorTemp;
      if (options.kelvin !== undefined) data.kelvin = options.kelvin;
      if (options.rgbColor !== undefined) data.rgb_color = options.rgbColor;
      if (options.hsColor !== undefined) data.hs_color = options.hsColor;
      if (options.xyColor !== undefined) data.xy_color = options.xyColor;
      if (options.transition !== undefined) data.transition = options.transition;
      if (options.effect !== undefined) data.effect = options.effect;
      if (options.flash !== undefined) data.flash = options.flash;
      if (options.colorName !== undefined) data.color_name = options.colorName;
    }

    return this.callService("light", "turn_on", data);
  }

  /**
   * Turn off a light
   */
  async turnOffLight(
    entityId: string | string[],
    transition?: number
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (transition !== undefined) data.transition = transition;
    return this.callService("light", "turn_off", data);
  }

  /**
   * Toggle a light
   */
  async toggleLight(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("light", "toggle", { entity_id: entityId });
  }

  /**
   * Set light brightness
   */
  async setLightBrightness(
    entityId: string | string[],
    brightnessPercent: number
  ): Promise<ServiceCallResult> {
    return this.turnOnLight(entityId, { brightnessPercent });
  }

  /**
   * Set light color
   */
  async setLightColor(
    entityId: string | string[],
    color: { rgb?: [number, number, number]; colorName?: string; kelvin?: number }
  ): Promise<ServiceCallResult> {
    return this.turnOnLight(entityId, {
      rgbColor: color.rgb,
      colorName: color.colorName,
      kelvin: color.kelvin,
    });
  }

  // ========== Switch Services ==========

  /**
   * Turn on a switch
   */
  async turnOnSwitch(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("switch", "turn_on", { entity_id: entityId });
  }

  /**
   * Turn off a switch
   */
  async turnOffSwitch(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("switch", "turn_off", { entity_id: entityId });
  }

  /**
   * Toggle a switch
   */
  async toggleSwitch(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("switch", "toggle", { entity_id: entityId });
  }

  // ========== Cover Services ==========

  /**
   * Open a cover
   */
  async openCover(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("cover", "open_cover", { entity_id: entityId });
  }

  /**
   * Close a cover
   */
  async closeCover(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("cover", "close_cover", { entity_id: entityId });
  }

  /**
   * Stop a cover
   */
  async stopCover(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("cover", "stop_cover", { entity_id: entityId });
  }

  /**
   * Toggle a cover
   */
  async toggleCover(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("cover", "toggle", { entity_id: entityId });
  }

  /**
   * Set cover position
   */
  async setCoverPosition(
    entityId: string | string[],
    position: number
  ): Promise<ServiceCallResult> {
    return this.callService("cover", "set_cover_position", {
      entity_id: entityId,
      position,
    });
  }

  /**
   * Set cover tilt position
   */
  async setCoverTiltPosition(
    entityId: string | string[],
    tiltPosition: number
  ): Promise<ServiceCallResult> {
    return this.callService("cover", "set_cover_tilt_position", {
      entity_id: entityId,
      tilt_position: tiltPosition,
    });
  }

  // ========== Climate Services ==========

  /**
   * Set HVAC mode
   */
  async setHvacMode(
    entityId: string | string[],
    hvacMode: ClimateOptions["hvacMode"]
  ): Promise<ServiceCallResult> {
    return this.callService("climate", "set_hvac_mode", {
      entity_id: entityId,
      hvac_mode: hvacMode,
    });
  }

  /**
   * Set temperature
   */
  async setTemperature(
    entityId: string | string[],
    temperature: number,
    hvacMode?: ClimateOptions["hvacMode"]
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = {
      entity_id: entityId,
      temperature,
    };
    if (hvacMode) data.hvac_mode = hvacMode;
    return this.callService("climate", "set_temperature", data);
  }

  /**
   * Set temperature range (for heat_cool mode)
   */
  async setTemperatureRange(
    entityId: string | string[],
    targetTempLow: number,
    targetTempHigh: number
  ): Promise<ServiceCallResult> {
    return this.callService("climate", "set_temperature", {
      entity_id: entityId,
      target_temp_low: targetTempLow,
      target_temp_high: targetTempHigh,
    });
  }

  /**
   * Set fan mode
   */
  async setClimateFanMode(
    entityId: string | string[],
    fanMode: string
  ): Promise<ServiceCallResult> {
    return this.callService("climate", "set_fan_mode", {
      entity_id: entityId,
      fan_mode: fanMode,
    });
  }

  /**
   * Set preset mode
   */
  async setClimatePresetMode(
    entityId: string | string[],
    presetMode: string
  ): Promise<ServiceCallResult> {
    return this.callService("climate", "set_preset_mode", {
      entity_id: entityId,
      preset_mode: presetMode,
    });
  }

  /**
   * Turn on climate
   */
  async turnOnClimate(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("climate", "turn_on", { entity_id: entityId });
  }

  /**
   * Turn off climate
   */
  async turnOffClimate(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("climate", "turn_off", { entity_id: entityId });
  }

  // ========== Fan Services ==========

  /**
   * Turn on a fan
   */
  async turnOnFan(
    entityId: string | string[],
    options?: FanOptions
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (options?.percentage !== undefined) data.percentage = options.percentage;
    if (options?.presetMode) data.preset_mode = options.presetMode;
    return this.callService("fan", "turn_on", data);
  }

  /**
   * Turn off a fan
   */
  async turnOffFan(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("fan", "turn_off", { entity_id: entityId });
  }

  /**
   * Toggle a fan
   */
  async toggleFan(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("fan", "toggle", { entity_id: entityId });
  }

  /**
   * Set fan speed percentage
   */
  async setFanPercentage(
    entityId: string | string[],
    percentage: number
  ): Promise<ServiceCallResult> {
    return this.callService("fan", "set_percentage", {
      entity_id: entityId,
      percentage,
    });
  }

  /**
   * Set fan direction
   */
  async setFanDirection(
    entityId: string | string[],
    direction: "forward" | "reverse"
  ): Promise<ServiceCallResult> {
    return this.callService("fan", "set_direction", {
      entity_id: entityId,
      direction,
    });
  }

  /**
   * Set fan oscillating mode
   */
  async oscillateFan(
    entityId: string | string[],
    oscillating: boolean
  ): Promise<ServiceCallResult> {
    return this.callService("fan", "oscillate", {
      entity_id: entityId,
      oscillating,
    });
  }

  // ========== Lock Services ==========

  /**
   * Lock a lock
   */
  async lock(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("lock", "lock", { entity_id: entityId });
  }

  /**
   * Unlock a lock
   */
  async unlock(
    entityId: string | string[],
    code?: string
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (code) data.code = code;
    return this.callService("lock", "unlock", data);
  }

  /**
   * Open a lock (for locks that support it)
   */
  async openLock(
    entityId: string | string[],
    code?: string
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (code) data.code = code;
    return this.callService("lock", "open", data);
  }

  // ========== Media Player Services ==========

  /**
   * Play media player
   */
  async mediaPlay(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("media_player", "media_play", { entity_id: entityId });
  }

  /**
   * Pause media player
   */
  async mediaPause(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("media_player", "media_pause", { entity_id: entityId });
  }

  /**
   * Stop media player
   */
  async mediaStop(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("media_player", "media_stop", { entity_id: entityId });
  }

  /**
   * Play/pause toggle
   */
  async mediaPlayPause(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("media_player", "media_play_pause", {
      entity_id: entityId,
    });
  }

  /**
   * Next track
   */
  async mediaNextTrack(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("media_player", "media_next_track", {
      entity_id: entityId,
    });
  }

  /**
   * Previous track
   */
  async mediaPreviousTrack(
    entityId: string | string[]
  ): Promise<ServiceCallResult> {
    return this.callService("media_player", "media_previous_track", {
      entity_id: entityId,
    });
  }

  /**
   * Set volume
   */
  async setMediaVolume(
    entityId: string | string[],
    volumeLevel: number
  ): Promise<ServiceCallResult> {
    return this.callService("media_player", "volume_set", {
      entity_id: entityId,
      volume_level: volumeLevel,
    });
  }

  /**
   * Mute/unmute
   */
  async setMediaMute(
    entityId: string | string[],
    isMuted: boolean
  ): Promise<ServiceCallResult> {
    return this.callService("media_player", "volume_mute", {
      entity_id: entityId,
      is_volume_muted: isMuted,
    });
  }

  /**
   * Select source
   */
  async selectMediaSource(
    entityId: string | string[],
    source: string
  ): Promise<ServiceCallResult> {
    return this.callService("media_player", "select_source", {
      entity_id: entityId,
      source,
    });
  }

  /**
   * Play media content
   */
  async playMedia(
    entityId: string | string[],
    mediaContentId: string,
    mediaContentType: string,
    announce?: boolean
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = {
      entity_id: entityId,
      media_content_id: mediaContentId,
      media_content_type: mediaContentType,
    };
    if (announce !== undefined) data.announce = announce;
    return this.callService("media_player", "play_media", data);
  }

  /**
   * Turn on media player
   */
  async turnOnMediaPlayer(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("media_player", "turn_on", { entity_id: entityId });
  }

  /**
   * Turn off media player
   */
  async turnOffMediaPlayer(
    entityId: string | string[]
  ): Promise<ServiceCallResult> {
    return this.callService("media_player", "turn_off", { entity_id: entityId });
  }

  // ========== Vacuum Services ==========

  /**
   * Start vacuum
   */
  async startVacuum(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("vacuum", "start", { entity_id: entityId });
  }

  /**
   * Pause vacuum
   */
  async pauseVacuum(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("vacuum", "pause", { entity_id: entityId });
  }

  /**
   * Stop vacuum
   */
  async stopVacuum(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("vacuum", "stop", { entity_id: entityId });
  }

  /**
   * Return vacuum to base
   */
  async returnVacuumToBase(
    entityId: string | string[]
  ): Promise<ServiceCallResult> {
    return this.callService("vacuum", "return_to_base", { entity_id: entityId });
  }

  /**
   * Locate vacuum
   */
  async locateVacuum(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("vacuum", "locate", { entity_id: entityId });
  }

  /**
   * Clean specific spot
   */
  async cleanSpot(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("vacuum", "clean_spot", { entity_id: entityId });
  }

  /**
   * Set vacuum fan speed
   */
  async setVacuumFanSpeed(
    entityId: string | string[],
    fanSpeed: string
  ): Promise<ServiceCallResult> {
    return this.callService("vacuum", "set_fan_speed", {
      entity_id: entityId,
      fan_speed: fanSpeed,
    });
  }

  // ========== Alarm Panel Services ==========

  /**
   * Arm alarm away
   */
  async armAlarmAway(
    entityId: string | string[],
    code?: string
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (code) data.code = code;
    return this.callService("alarm_control_panel", "alarm_arm_away", data);
  }

  /**
   * Arm alarm home/stay
   */
  async armAlarmHome(
    entityId: string | string[],
    code?: string
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (code) data.code = code;
    return this.callService("alarm_control_panel", "alarm_arm_home", data);
  }

  /**
   * Arm alarm night
   */
  async armAlarmNight(
    entityId: string | string[],
    code?: string
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (code) data.code = code;
    return this.callService("alarm_control_panel", "alarm_arm_night", data);
  }

  /**
   * Disarm alarm
   */
  async disarmAlarm(
    entityId: string | string[],
    code?: string
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (code) data.code = code;
    return this.callService("alarm_control_panel", "alarm_disarm", data);
  }

  /**
   * Trigger alarm
   */
  async triggerAlarm(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("alarm_control_panel", "alarm_trigger", {
      entity_id: entityId,
    });
  }

  // ========== Scene Services ==========

  /**
   * Activate a scene
   */
  async activateScene(entityId: string): Promise<ServiceCallResult> {
    return this.callService("scene", "turn_on", { entity_id: entityId });
  }

  // ========== Input Boolean Services ==========

  /**
   * Turn on input boolean
   */
  async turnOnInputBoolean(
    entityId: string | string[]
  ): Promise<ServiceCallResult> {
    return this.callService("input_boolean", "turn_on", { entity_id: entityId });
  }

  /**
   * Turn off input boolean
   */
  async turnOffInputBoolean(
    entityId: string | string[]
  ): Promise<ServiceCallResult> {
    return this.callService("input_boolean", "turn_off", { entity_id: entityId });
  }

  /**
   * Toggle input boolean
   */
  async toggleInputBoolean(
    entityId: string | string[]
  ): Promise<ServiceCallResult> {
    return this.callService("input_boolean", "toggle", { entity_id: entityId });
  }

  // ========== Input Number Services ==========

  /**
   * Set input number value
   */
  async setInputNumber(
    entityId: string,
    value: number
  ): Promise<ServiceCallResult> {
    return this.callService("input_number", "set_value", {
      entity_id: entityId,
      value,
    });
  }

  /**
   * Increment input number
   */
  async incrementInputNumber(entityId: string): Promise<ServiceCallResult> {
    return this.callService("input_number", "increment", { entity_id: entityId });
  }

  /**
   * Decrement input number
   */
  async decrementInputNumber(entityId: string): Promise<ServiceCallResult> {
    return this.callService("input_number", "decrement", { entity_id: entityId });
  }

  // ========== Input Select Services ==========

  /**
   * Select an option
   */
  async selectOption(
    entityId: string,
    option: string
  ): Promise<ServiceCallResult> {
    return this.callService("input_select", "select_option", {
      entity_id: entityId,
      option,
    });
  }

  /**
   * Select first option
   */
  async selectFirstOption(entityId: string): Promise<ServiceCallResult> {
    return this.callService("input_select", "select_first", {
      entity_id: entityId,
    });
  }

  /**
   * Select last option
   */
  async selectLastOption(entityId: string): Promise<ServiceCallResult> {
    return this.callService("input_select", "select_last", {
      entity_id: entityId,
    });
  }

  /**
   * Select next option
   */
  async selectNextOption(
    entityId: string,
    cycle?: boolean
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (cycle !== undefined) data.cycle = cycle;
    return this.callService("input_select", "select_next", data);
  }

  /**
   * Select previous option
   */
  async selectPreviousOption(
    entityId: string,
    cycle?: boolean
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (cycle !== undefined) data.cycle = cycle;
    return this.callService("input_select", "select_previous", data);
  }

  // ========== Input Text Services ==========

  /**
   * Set input text value
   */
  async setInputText(entityId: string, value: string): Promise<ServiceCallResult> {
    return this.callService("input_text", "set_value", {
      entity_id: entityId,
      value,
    });
  }

  // ========== Generic Turn On/Off ==========

  /**
   * Generic turn on (works with multiple domains)
   */
  async turnOn(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("homeassistant", "turn_on", { entity_id: entityId });
  }

  /**
   * Generic turn off (works with multiple domains)
   */
  async turnOff(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("homeassistant", "turn_off", { entity_id: entityId });
  }

  /**
   * Generic toggle (works with multiple domains)
   */
  async toggle(entityId: string | string[]): Promise<ServiceCallResult> {
    return this.callService("homeassistant", "toggle", { entity_id: entityId });
  }

  // ========== Notification Services ==========

  /**
   * Send a notification
   */
  async notify(
    message: string,
    title?: string,
    target?: string,
    data?: Record<string, unknown>
  ): Promise<ServiceCallResult> {
    const serviceData: Record<string, unknown> = { message };
    if (title) serviceData.title = title;
    if (target) serviceData.target = target;
    if (data) serviceData.data = data;

    return this.callService("notify", "notify", serviceData);
  }

  /**
   * Send a persistent notification
   */
  async persistentNotification(
    message: string,
    title?: string,
    notificationId?: string
  ): Promise<ServiceCallResult> {
    const data: Record<string, unknown> = { message };
    if (title) data.title = title;
    if (notificationId) data.notification_id = notificationId;

    return this.callService("persistent_notification", "create", data);
  }

  /**
   * Dismiss a persistent notification
   */
  async dismissPersistentNotification(
    notificationId: string
  ): Promise<ServiceCallResult> {
    return this.callService("persistent_notification", "dismiss", {
      notification_id: notificationId,
    });
  }
}

/**
 * Create a service manager instance
 */
export function createServiceManager(
  client: HomeAssistantClient
): ServiceManager {
  return new ServiceManager(client);
}

export default ServiceManager;
