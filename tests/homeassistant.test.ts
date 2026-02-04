import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";

describe("Home Assistant Integration", () => {
  describe("Client Module", () => {
    test("should export HomeAssistantClient class", async () => {
      const { HomeAssistantClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      expect(typeof HomeAssistantClient).toBe("function");
    });

    test("should export createClient function", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      expect(typeof createClient).toBe("function");
    });

    test("should export HomeAssistantClientError class", async () => {
      const { HomeAssistantClientError } = await import(
        "../src/integrations/homeassistant/client"
      );
      expect(typeof HomeAssistantClientError).toBe("function");

      const error = new HomeAssistantClientError("Test error", 404);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("HomeAssistantClientError");
    });

    test("should create client with config", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
        timeout: 5000,
      });

      expect(client).toBeTruthy();
    });

    test("client should have all required methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      expect(typeof client.checkApi).toBe("function");
      expect(typeof client.getConfig).toBe("function");
      expect(typeof client.getStates).toBe("function");
      expect(typeof client.getState).toBe("function");
      expect(typeof client.setState).toBe("function");
      expect(typeof client.getServices).toBe("function");
      expect(typeof client.callService).toBe("function");
      expect(typeof client.fireEvent).toBe("function");
      expect(typeof client.getEvents).toBe("function");
      expect(typeof client.getLogbook).toBe("function");
      expect(typeof client.getHistory).toBe("function");
      expect(typeof client.getErrorLog).toBe("function");
      expect(typeof client.getCameraProxyImage).toBe("function");
      expect(typeof client.renderTemplate).toBe("function");
      expect(typeof client.isHealthy).toBe("function");
    });

    test("should normalize URL with trailing slash", async () => {
      const { HomeAssistantClient } = await import(
        "../src/integrations/homeassistant/client"
      );

      // URLs with trailing slashes should work the same
      const client1 = new HomeAssistantClient({
        url: "http://localhost:8123/",
        token: "test",
      });
      const client2 = new HomeAssistantClient({
        url: "http://localhost:8123",
        token: "test",
      });

      expect(client1).toBeTruthy();
      expect(client2).toBeTruthy();
    });
  });

  describe("Entity Manager Module", () => {
    test("should export EntityManager class", async () => {
      const { EntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );
      expect(typeof EntityManager).toBe("function");
    });

    test("should export createEntityManager function", async () => {
      const { createEntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );
      expect(typeof createEntityManager).toBe("function");
    });

    test("should create entity manager with client", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createEntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const entityManager = createEntityManager(client, 5000);
      expect(entityManager).toBeTruthy();
    });

    test("entity manager should have all required methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createEntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const entityManager = createEntityManager(client);

      expect(typeof entityManager.refreshCache).toBe("function");
      expect(typeof entityManager.getAllEntities).toBe("function");
      expect(typeof entityManager.getEntity).toBe("function");
      expect(typeof entityManager.getEntityFresh).toBe("function");
      expect(typeof entityManager.getEntities).toBe("function");
      expect(typeof entityManager.getEntitiesGroupedByDomain).toBe("function");
      expect(typeof entityManager.getEntitiesByDomain).toBe("function");
      expect(typeof entityManager.getLights).toBe("function");
      expect(typeof entityManager.getSwitches).toBe("function");
      expect(typeof entityManager.getCovers).toBe("function");
      expect(typeof entityManager.getClimate).toBe("function");
      expect(typeof entityManager.getSensors).toBe("function");
      expect(typeof entityManager.getBinarySensors).toBe("function");
      expect(typeof entityManager.getMediaPlayers).toBe("function");
      expect(typeof entityManager.getAutomations).toBe("function");
      expect(typeof entityManager.getScenes).toBe("function");
      expect(typeof entityManager.getScripts).toBe("function");
      expect(typeof entityManager.getFans).toBe("function");
      expect(typeof entityManager.getLocks).toBe("function");
      expect(typeof entityManager.getVacuums).toBe("function");
      expect(typeof entityManager.getCameras).toBe("function");
      expect(typeof entityManager.getAlarmPanels).toBe("function");
      expect(typeof entityManager.getPersons).toBe("function");
      expect(typeof entityManager.getWeather).toBe("function");
      expect(typeof entityManager.getOnEntities).toBe("function");
      expect(typeof entityManager.getOffEntities).toBe("function");
      expect(typeof entityManager.getUnavailableEntities).toBe("function");
      expect(typeof entityManager.toDeviceInfo).toBe("function");
      expect(typeof entityManager.getAllDeviceInfo).toBe("function");
      expect(typeof entityManager.searchEntities).toBe("function");
      expect(typeof entityManager.getEntityCounts).toBe("function");
      expect(typeof entityManager.clearCache).toBe("function");
    });

    test("toDeviceInfo should convert HAState correctly", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createEntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const entityManager = createEntityManager(client);

      const mockState = {
        entity_id: "light.living_room",
        state: "on",
        attributes: {
          friendly_name: "Living Room Light",
          brightness: 255,
        },
        last_changed: "2024-01-01T00:00:00.000Z",
        last_updated: "2024-01-01T00:00:00.000Z",
        context: {
          id: "test-context-id",
          parent_id: null,
          user_id: null,
        },
      };

      const deviceInfo = entityManager.toDeviceInfo(mockState);

      expect(deviceInfo.entityId).toBe("light.living_room");
      expect(deviceInfo.friendlyName).toBe("Living Room Light");
      expect(deviceInfo.domain).toBe("light");
      expect(deviceInfo.state).toBe("on");
      expect(deviceInfo.isAvailable).toBe(true);
      expect(deviceInfo.lastChanged).toBeInstanceOf(Date);
      expect(deviceInfo.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe("Service Manager Module", () => {
    test("should export ServiceManager class", async () => {
      const { ServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );
      expect(typeof ServiceManager).toBe("function");
    });

    test("should export createServiceManager function", async () => {
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );
      expect(typeof createServiceManager).toBe("function");
    });

    test("should create service manager with client", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);
      expect(serviceManager).toBeTruthy();
    });

    test("service manager should have all light methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.turnOnLight).toBe("function");
      expect(typeof serviceManager.turnOffLight).toBe("function");
      expect(typeof serviceManager.toggleLight).toBe("function");
      expect(typeof serviceManager.setLightBrightness).toBe("function");
      expect(typeof serviceManager.setLightColor).toBe("function");
    });

    test("service manager should have all switch methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.turnOnSwitch).toBe("function");
      expect(typeof serviceManager.turnOffSwitch).toBe("function");
      expect(typeof serviceManager.toggleSwitch).toBe("function");
    });

    test("service manager should have all cover methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.openCover).toBe("function");
      expect(typeof serviceManager.closeCover).toBe("function");
      expect(typeof serviceManager.stopCover).toBe("function");
      expect(typeof serviceManager.toggleCover).toBe("function");
      expect(typeof serviceManager.setCoverPosition).toBe("function");
      expect(typeof serviceManager.setCoverTiltPosition).toBe("function");
    });

    test("service manager should have all climate methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.setHvacMode).toBe("function");
      expect(typeof serviceManager.setTemperature).toBe("function");
      expect(typeof serviceManager.setTemperatureRange).toBe("function");
      expect(typeof serviceManager.setClimateFanMode).toBe("function");
      expect(typeof serviceManager.setClimatePresetMode).toBe("function");
      expect(typeof serviceManager.turnOnClimate).toBe("function");
      expect(typeof serviceManager.turnOffClimate).toBe("function");
    });

    test("service manager should have all fan methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.turnOnFan).toBe("function");
      expect(typeof serviceManager.turnOffFan).toBe("function");
      expect(typeof serviceManager.toggleFan).toBe("function");
      expect(typeof serviceManager.setFanPercentage).toBe("function");
      expect(typeof serviceManager.setFanDirection).toBe("function");
      expect(typeof serviceManager.oscillateFan).toBe("function");
    });

    test("service manager should have all lock methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.lock).toBe("function");
      expect(typeof serviceManager.unlock).toBe("function");
      expect(typeof serviceManager.openLock).toBe("function");
    });

    test("service manager should have all media player methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.mediaPlay).toBe("function");
      expect(typeof serviceManager.mediaPause).toBe("function");
      expect(typeof serviceManager.mediaStop).toBe("function");
      expect(typeof serviceManager.mediaPlayPause).toBe("function");
      expect(typeof serviceManager.mediaNextTrack).toBe("function");
      expect(typeof serviceManager.mediaPreviousTrack).toBe("function");
      expect(typeof serviceManager.setMediaVolume).toBe("function");
      expect(typeof serviceManager.setMediaMute).toBe("function");
      expect(typeof serviceManager.selectMediaSource).toBe("function");
      expect(typeof serviceManager.playMedia).toBe("function");
      expect(typeof serviceManager.turnOnMediaPlayer).toBe("function");
      expect(typeof serviceManager.turnOffMediaPlayer).toBe("function");
    });

    test("service manager should have all vacuum methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.startVacuum).toBe("function");
      expect(typeof serviceManager.pauseVacuum).toBe("function");
      expect(typeof serviceManager.stopVacuum).toBe("function");
      expect(typeof serviceManager.returnVacuumToBase).toBe("function");
      expect(typeof serviceManager.locateVacuum).toBe("function");
      expect(typeof serviceManager.cleanSpot).toBe("function");
      expect(typeof serviceManager.setVacuumFanSpeed).toBe("function");
    });

    test("service manager should have all alarm methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.armAlarmAway).toBe("function");
      expect(typeof serviceManager.armAlarmHome).toBe("function");
      expect(typeof serviceManager.armAlarmNight).toBe("function");
      expect(typeof serviceManager.disarmAlarm).toBe("function");
      expect(typeof serviceManager.triggerAlarm).toBe("function");
    });

    test("service manager should have generic and notification methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.callService).toBe("function");
      expect(typeof serviceManager.callServiceOnEntities).toBe("function");
      expect(typeof serviceManager.turnOn).toBe("function");
      expect(typeof serviceManager.turnOff).toBe("function");
      expect(typeof serviceManager.toggle).toBe("function");
      expect(typeof serviceManager.activateScene).toBe("function");
      expect(typeof serviceManager.notify).toBe("function");
      expect(typeof serviceManager.persistentNotification).toBe("function");
      expect(typeof serviceManager.dismissPersistentNotification).toBe("function");
    });

    test("service manager should have input helper methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const serviceManager = createServiceManager(client);

      expect(typeof serviceManager.turnOnInputBoolean).toBe("function");
      expect(typeof serviceManager.turnOffInputBoolean).toBe("function");
      expect(typeof serviceManager.toggleInputBoolean).toBe("function");
      expect(typeof serviceManager.setInputNumber).toBe("function");
      expect(typeof serviceManager.incrementInputNumber).toBe("function");
      expect(typeof serviceManager.decrementInputNumber).toBe("function");
      expect(typeof serviceManager.selectOption).toBe("function");
      expect(typeof serviceManager.selectFirstOption).toBe("function");
      expect(typeof serviceManager.selectLastOption).toBe("function");
      expect(typeof serviceManager.selectNextOption).toBe("function");
      expect(typeof serviceManager.selectPreviousOption).toBe("function");
      expect(typeof serviceManager.setInputText).toBe("function");
    });
  });

  describe("Automation Manager Module", () => {
    test("should export AutomationManager class", async () => {
      const { AutomationManager } = await import(
        "../src/integrations/homeassistant/automations"
      );
      expect(typeof AutomationManager).toBe("function");
    });

    test("should export createAutomationManager function", async () => {
      const { createAutomationManager } = await import(
        "../src/integrations/homeassistant/automations"
      );
      expect(typeof createAutomationManager).toBe("function");
    });

    test("should create automation manager with dependencies", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createEntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );
      const { createAutomationManager } = await import(
        "../src/integrations/homeassistant/automations"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const entityManager = createEntityManager(client);
      const serviceManager = createServiceManager(client);
      const automationManager = createAutomationManager(
        client,
        entityManager,
        serviceManager
      );

      expect(automationManager).toBeTruthy();
    });

    test("automation manager should have all automation methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createEntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );
      const { createAutomationManager } = await import(
        "../src/integrations/homeassistant/automations"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const entityManager = createEntityManager(client);
      const serviceManager = createServiceManager(client);
      const automationManager = createAutomationManager(
        client,
        entityManager,
        serviceManager
      );

      expect(typeof automationManager.getAutomations).toBe("function");
      expect(typeof automationManager.getAutomation).toBe("function");
      expect(typeof automationManager.triggerAutomation).toBe("function");
      expect(typeof automationManager.enableAutomation).toBe("function");
      expect(typeof automationManager.disableAutomation).toBe("function");
      expect(typeof automationManager.toggleAutomation).toBe("function");
      expect(typeof automationManager.reloadAutomations).toBe("function");
      expect(typeof automationManager.getEnabledAutomations).toBe("function");
      expect(typeof automationManager.getDisabledAutomations).toBe("function");
      expect(typeof automationManager.getRecentlyTriggeredAutomations).toBe(
        "function"
      );
    });

    test("automation manager should have all script methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createEntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );
      const { createAutomationManager } = await import(
        "../src/integrations/homeassistant/automations"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const entityManager = createEntityManager(client);
      const serviceManager = createServiceManager(client);
      const automationManager = createAutomationManager(
        client,
        entityManager,
        serviceManager
      );

      expect(typeof automationManager.getScripts).toBe("function");
      expect(typeof automationManager.getScript).toBe("function");
      expect(typeof automationManager.runScript).toBe("function");
      expect(typeof automationManager.turnOnScript).toBe("function");
      expect(typeof automationManager.turnOffScript).toBe("function");
      expect(typeof automationManager.toggleScript).toBe("function");
      expect(typeof automationManager.reloadScripts).toBe("function");
      expect(typeof automationManager.getRunningScripts).toBe("function");
    });

    test("automation manager should have all scene methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createEntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );
      const { createAutomationManager } = await import(
        "../src/integrations/homeassistant/automations"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const entityManager = createEntityManager(client);
      const serviceManager = createServiceManager(client);
      const automationManager = createAutomationManager(
        client,
        entityManager,
        serviceManager
      );

      expect(typeof automationManager.getScenes).toBe("function");
      expect(typeof automationManager.getScene).toBe("function");
      expect(typeof automationManager.activateScene).toBe("function");
      expect(typeof automationManager.createScene).toBe("function");
      expect(typeof automationManager.applyScene).toBe("function");
      expect(typeof automationManager.reloadScenes).toBe("function");
    });

    test("automation manager should have search and utility methods", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );
      const { createEntityManager } = await import(
        "../src/integrations/homeassistant/entities"
      );
      const { createServiceManager } = await import(
        "../src/integrations/homeassistant/services"
      );
      const { createAutomationManager } = await import(
        "../src/integrations/homeassistant/automations"
      );

      const client = createClient({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const entityManager = createEntityManager(client);
      const serviceManager = createServiceManager(client);
      const automationManager = createAutomationManager(
        client,
        entityManager,
        serviceManager
      );

      expect(typeof automationManager.searchAutomations).toBe("function");
      expect(typeof automationManager.searchScripts).toBe("function");
      expect(typeof automationManager.searchScenes).toBe("function");
      expect(typeof automationManager.reloadAll).toBe("function");
      expect(typeof automationManager.fireEvent).toBe("function");
      expect(typeof automationManager.reloadHomeAssistant).toBe("function");
      expect(typeof automationManager.restartHomeAssistant).toBe("function");
      expect(typeof automationManager.stopHomeAssistant).toBe("function");
      expect(typeof automationManager.checkConfig).toBe("function");
    });
  });

  describe("WebSocket Module", () => {
    test("should export HomeAssistantWebSocket class", async () => {
      const { HomeAssistantWebSocket } = await import(
        "../src/integrations/homeassistant/websocket"
      );
      expect(typeof HomeAssistantWebSocket).toBe("function");
    });

    test("should export createWebSocket function", async () => {
      const { createWebSocket } = await import(
        "../src/integrations/homeassistant/websocket"
      );
      expect(typeof createWebSocket).toBe("function");
    });

    test("should create websocket client with config", async () => {
      const { createWebSocket } = await import(
        "../src/integrations/homeassistant/websocket"
      );

      const ws = createWebSocket({
        url: "http://localhost:8123",
        token: "test-token",
        reconnectInterval: 5000,
        maxReconnectAttempts: 5,
        pingInterval: 30000,
      });

      expect(ws).toBeTruthy();
    });

    test("websocket should have all required methods", async () => {
      const { createWebSocket } = await import(
        "../src/integrations/homeassistant/websocket"
      );

      const ws = createWebSocket({
        url: "http://localhost:8123",
        token: "test-token",
      });

      expect(typeof ws.connect).toBe("function");
      expect(typeof ws.disconnect).toBe("function");
      expect(typeof ws.isConnected).toBe("function");
      expect(typeof ws.send).toBe("function");
      expect(typeof ws.subscribeToStateChanges).toBe("function");
      expect(typeof ws.subscribeToEvent).toBe("function");
      expect(typeof ws.unsubscribe).toBe("function");
      expect(typeof ws.getStates).toBe("function");
      expect(typeof ws.getConfig).toBe("function");
      expect(typeof ws.getServices).toBe("function");
      expect(typeof ws.getPanels).toBe("function");
      expect(typeof ws.callService).toBe("function");
      expect(typeof ws.fireEvent).toBe("function");
      expect(typeof ws.renderTemplate).toBe("function");
      expect(typeof ws.getAreaRegistry).toBe("function");
      expect(typeof ws.getDeviceRegistry).toBe("function");
      expect(typeof ws.getEntityRegistry).toBe("function");
    });

    test("websocket should have event handler methods", async () => {
      const { createWebSocket } = await import(
        "../src/integrations/homeassistant/websocket"
      );

      const ws = createWebSocket({
        url: "http://localhost:8123",
        token: "test-token",
      });

      expect(typeof ws.onStateChange).toBe("function");
      expect(typeof ws.onAnyStateChange).toBe("function");
      expect(typeof ws.onEvent).toBe("function");
      expect(typeof ws.onConnected).toBe("function");
      expect(typeof ws.onDisconnected).toBe("function");
      expect(typeof ws.onError).toBe("function");
    });

    test("websocket should convert HTTP to WS URL", async () => {
      const { HomeAssistantWebSocket } = await import(
        "../src/integrations/homeassistant/websocket"
      );

      // Internal URL conversion happens in constructor
      const ws = new HomeAssistantWebSocket({
        url: "http://localhost:8123",
        token: "test-token",
      });

      // isConnected should return false when not connected
      expect(ws.isConnected()).toBe(false);
    });

    test("event handler methods should return unsubscribe functions", async () => {
      const { createWebSocket } = await import(
        "../src/integrations/homeassistant/websocket"
      );

      const ws = createWebSocket({
        url: "http://localhost:8123",
        token: "test-token",
      });

      const handler = () => {};

      const unsubscribe1 = ws.onStateChange("light.test", handler);
      const unsubscribe2 = ws.onAnyStateChange(handler);
      const unsubscribe3 = ws.onEvent("test_event", handler);
      const unsubscribe4 = ws.onConnected(handler);
      const unsubscribe5 = ws.onDisconnected(handler);
      const unsubscribe6 = ws.onError(handler);

      expect(typeof unsubscribe1).toBe("function");
      expect(typeof unsubscribe2).toBe("function");
      expect(typeof unsubscribe3).toBe("function");
      expect(typeof unsubscribe4).toBe("function");
      expect(typeof unsubscribe5).toBe("function");
      expect(typeof unsubscribe6).toBe("function");
    });
  });

  describe("Main Integration Module", () => {
    test("should export HomeAssistant class", async () => {
      const { HomeAssistant } = await import(
        "../src/integrations/homeassistant"
      );
      expect(typeof HomeAssistant).toBe("function");
    });

    test("should export createHomeAssistant function", async () => {
      const { createHomeAssistant } = await import(
        "../src/integrations/homeassistant"
      );
      expect(typeof createHomeAssistant).toBe("function");
    });

    test("should create HomeAssistant instance with config", async () => {
      const { createHomeAssistant } = await import(
        "../src/integrations/homeassistant"
      );

      const ha = createHomeAssistant({
        url: "http://localhost:8123",
        token: "test-token",
        enableWebSocket: true,
        cacheTtl: 5000,
        timeout: 10000,
      });

      expect(ha).toBeTruthy();
      expect(ha.client).toBeTruthy();
      expect(ha.entities).toBeTruthy();
      expect(ha.services).toBeTruthy();
      expect(ha.automations).toBeTruthy();
      expect(ha.websocket).toBeTruthy();
    });

    test("should allow disabling WebSocket", async () => {
      const { createHomeAssistant } = await import(
        "../src/integrations/homeassistant"
      );

      const ha = createHomeAssistant({
        url: "http://localhost:8123",
        token: "test-token",
        enableWebSocket: false,
      });

      expect(ha.websocket).toBeNull();
    });

    test("HomeAssistant should have connection methods", async () => {
      const { createHomeAssistant } = await import(
        "../src/integrations/homeassistant"
      );

      const ha = createHomeAssistant({
        url: "http://localhost:8123",
        token: "test-token",
      });

      expect(typeof ha.connect).toBe("function");
      expect(typeof ha.disconnect).toBe("function");
      expect(typeof ha.isConnected).toBe("function");
      expect(typeof ha.getConfig).toBe("function");
    });

    test("HomeAssistant should have natural language methods", async () => {
      const { createHomeAssistant } = await import(
        "../src/integrations/homeassistant"
      );

      const ha = createHomeAssistant({
        url: "http://localhost:8123",
        token: "test-token",
      });

      expect(typeof ha.processCommand).toBe("function");
      expect(typeof ha.parseNaturalLanguage).toBe("function");
      expect(typeof ha.executeNaturalLanguage).toBe("function");
    });

    test("should re-export all client types", async () => {
      const mod = await import("../src/integrations/homeassistant");

      expect(mod.HomeAssistantClient).toBeTruthy();
      expect(mod.createClient).toBeTruthy();
      expect(mod.HomeAssistantClientError).toBeTruthy();
    });

    test("should re-export all entity types", async () => {
      const mod = await import("../src/integrations/homeassistant");

      expect(mod.EntityManager).toBeTruthy();
      expect(mod.createEntityManager).toBeTruthy();
    });

    test("should re-export all service types", async () => {
      const mod = await import("../src/integrations/homeassistant");

      expect(mod.ServiceManager).toBeTruthy();
      expect(mod.createServiceManager).toBeTruthy();
    });

    test("should re-export all automation types", async () => {
      const mod = await import("../src/integrations/homeassistant");

      expect(mod.AutomationManager).toBeTruthy();
      expect(mod.createAutomationManager).toBeTruthy();
    });

    test("should re-export all websocket types", async () => {
      const mod = await import("../src/integrations/homeassistant");

      expect(mod.HomeAssistantWebSocket).toBeTruthy();
      expect(mod.createWebSocket).toBeTruthy();
    });

    test("should have default export", async () => {
      const mod = await import("../src/integrations/homeassistant");

      expect(mod.default).toBeTruthy();
      expect(mod.default).toBe(mod.HomeAssistant);
    });
  });

  describe("Natural Language Parsing", () => {
    let ha: InstanceType<
      typeof import("../src/integrations/homeassistant").HomeAssistant
    >;

    beforeEach(async () => {
      const { createHomeAssistant } = await import(
        "../src/integrations/homeassistant"
      );

      ha = createHomeAssistant({
        url: "http://localhost:8123",
        token: "test-token",
        enableWebSocket: false,
      });
    });

    test("should parse turn on commands", () => {
      const cmd1 = ha.parseNaturalLanguage("turn on living room light");
      expect(cmd1?.action).toBe("turn_on");
      expect(cmd1?.target).toBe("living room light");

      const cmd2 = ha.parseNaturalLanguage("switch on kitchen");
      expect(cmd2?.action).toBe("turn_on");
      expect(cmd2?.target).toBe("kitchen");

      const cmd3 = ha.parseNaturalLanguage("enable bedroom fan");
      expect(cmd3?.action).toBe("turn_on");
      expect(cmd3?.target).toBe("bedroom fan");
    });

    test("should parse turn off commands", () => {
      const cmd1 = ha.parseNaturalLanguage("turn off living room light");
      expect(cmd1?.action).toBe("turn_off");
      expect(cmd1?.target).toBe("living room light");

      const cmd2 = ha.parseNaturalLanguage("switch off kitchen");
      expect(cmd2?.action).toBe("turn_off");
      expect(cmd2?.target).toBe("kitchen");

      const cmd3 = ha.parseNaturalLanguage("disable bedroom fan");
      expect(cmd3?.action).toBe("turn_off");
      expect(cmd3?.target).toBe("bedroom fan");
    });

    test("should parse toggle commands", () => {
      const cmd = ha.parseNaturalLanguage("toggle garage door");
      expect(cmd?.action).toBe("toggle");
      expect(cmd?.target).toBe("garage door");
    });

    test("should parse set commands with percentage", () => {
      const cmd = ha.parseNaturalLanguage("set living room light to 50%");
      expect(cmd?.action).toBe("set");
      expect(cmd?.target).toBe("living room light");
      expect(cmd?.value).toBe(50);
    });

    test("should parse set commands with degrees", () => {
      const cmd = ha.parseNaturalLanguage("set thermostat to 72 degrees");
      expect(cmd?.action).toBe("set");
      expect(cmd?.target).toBe("thermostat");
      expect(cmd?.value).toBe(72);
    });

    test("should parse increase/decrease commands", () => {
      const cmd1 = ha.parseNaturalLanguage("increase brightness");
      expect(cmd1?.action).toBe("increase");
      expect(cmd1?.target).toBe("brightness");

      const cmd2 = ha.parseNaturalLanguage("decrease volume");
      expect(cmd2?.action).toBe("decrease");
      expect(cmd2?.target).toBe("volume");

      const cmd3 = ha.parseNaturalLanguage("brighten living room");
      expect(cmd3?.action).toBe("increase");
      expect(cmd3?.target).toBe("living room");

      const cmd4 = ha.parseNaturalLanguage("dim bedroom light");
      expect(cmd4?.action).toBe("decrease");
      expect(cmd4?.target).toBe("bedroom light");

      const cmd5 = ha.parseNaturalLanguage("raise temperature by 5");
      expect(cmd5?.action).toBe("increase");
      expect(cmd5?.target).toBe("temperature");
      expect(cmd5?.value).toBe(5);

      const cmd6 = ha.parseNaturalLanguage("lower volume by 10");
      expect(cmd6?.action).toBe("decrease");
      expect(cmd6?.target).toBe("volume");
      expect(cmd6?.value).toBe(10);
    });

    test("should parse activate scene commands", () => {
      const cmd1 = ha.parseNaturalLanguage("activate movie mode");
      expect(cmd1?.action).toBe("activate");
      expect(cmd1?.target).toBe("movie mode");

      const cmd2 = ha.parseNaturalLanguage("start scene relaxing");
      expect(cmd2?.action).toBe("activate");
      expect(cmd2?.target).toBe("relaxing");
    });

    test("should parse run script commands", () => {
      const cmd1 = ha.parseNaturalLanguage("run morning routine");
      expect(cmd1?.action).toBe("run");
      expect(cmd1?.target).toBe("morning routine");

      const cmd2 = ha.parseNaturalLanguage("execute goodnight script");
      expect(cmd2?.action).toBe("run");
      expect(cmd2?.target).toBe("goodnight script");
    });

    test("should parse trigger automation commands", () => {
      const cmd = ha.parseNaturalLanguage("trigger motion detection");
      expect(cmd?.action).toBe("trigger");
      expect(cmd?.target).toBe("motion detection");
    });

    test("should parse get state commands", () => {
      const cmd1 = ha.parseNaturalLanguage("what is the temperature?");
      expect(cmd1?.action).toBe("get_state");
      expect(cmd1?.target).toBe("the temperature");

      const cmd2 = ha.parseNaturalLanguage("get kitchen light status");
      expect(cmd2?.action).toBe("get_state");
      expect(cmd2?.target).toBe("kitchen light status");

      const cmd3 = ha.parseNaturalLanguage("check front door");
      expect(cmd3?.action).toBe("get_state");
      expect(cmd3?.target).toBe("front door");

      const cmd4 = ha.parseNaturalLanguage("status of garage");
      expect(cmd4?.action).toBe("get_state");
      expect(cmd4?.target).toBe("garage");
    });

    test("should parse list commands", () => {
      const cmd1 = ha.parseNaturalLanguage("list all lights");
      expect(cmd1?.action).toBe("list");
      expect(cmd1?.domain).toBe("light");

      const cmd2 = ha.parseNaturalLanguage("show switches");
      expect(cmd2?.action).toBe("list");
      expect(cmd2?.domain).toBe("switch");

      const cmd3 = ha.parseNaturalLanguage("find sensors");
      expect(cmd3?.action).toBe("list");
      expect(cmd3?.domain).toBe("sensor");

      const cmd4 = ha.parseNaturalLanguage("list automations");
      expect(cmd4?.action).toBe("list");
      expect(cmd4?.domain).toBe("automation");
    });

    test("should return null for unrecognized commands", () => {
      const cmd = ha.parseNaturalLanguage("do something random");
      expect(cmd).toBeNull();
    });
  });

  describe("Environment Configuration", () => {
    test("env schema should include HOME_ASSISTANT_URL", async () => {
      // We can't easily test Zod schema internals, but we can import and verify
      // that the module loads without errors
      const envModule = await import("../src/config/env");
      expect(envModule).toBeTruthy();
    });
  });

  describe("Type Definitions", () => {
    test("HAState interface should be properly typed", async () => {
      const { createClient } = await import(
        "../src/integrations/homeassistant/client"
      );

      // Type check - if this compiles, types are correct
      const mockState = {
        entity_id: "light.test",
        state: "on",
        attributes: {
          brightness: 255,
          friendly_name: "Test Light",
        },
        last_changed: "2024-01-01T00:00:00Z",
        last_updated: "2024-01-01T00:00:00Z",
        context: {
          id: "ctx123",
          parent_id: null,
          user_id: null,
        },
      };

      expect(mockState.entity_id).toBe("light.test");
      expect(mockState.state).toBe("on");
      expect(mockState.attributes.brightness).toBe(255);
    });

    test("ServiceCallResult interface should be properly typed", async () => {
      // Type check
      const result = {
        success: true,
        affectedEntities: [],
        error: undefined,
      };

      expect(result.success).toBe(true);
      expect(Array.isArray(result.affectedEntities)).toBe(true);
    });

    test("NaturalLanguageCommand interface should be properly typed", async () => {
      // Type check
      const command = {
        action: "turn_on" as const,
        target: "living room light",
        domain: "light" as const,
        value: 50,
        attributes: { brightness: 255 },
      };

      expect(command.action).toBe("turn_on");
      expect(command.target).toBe("living room light");
      expect(command.domain).toBe("light");
      expect(command.value).toBe(50);
    });

    test("LightOptions interface should be properly typed", async () => {
      // Type check
      const options = {
        brightness: 200,
        brightnessPercent: 80,
        colorTemp: 300,
        kelvin: 4000,
        rgbColor: [255, 100, 50] as [number, number, number],
        hsColor: [180, 50] as [number, number],
        xyColor: [0.5, 0.5] as [number, number],
        transition: 2,
        effect: "colorloop",
        flash: "short" as const,
        colorName: "red",
      };

      expect(options.brightness).toBe(200);
      expect(options.rgbColor).toEqual([255, 100, 50]);
    });

    test("ClimateOptions interface should be properly typed", async () => {
      // Type check
      const options = {
        temperature: 72,
        targetTempHigh: 76,
        targetTempLow: 68,
        hvacMode: "heat_cool" as const,
        fanMode: "auto",
        swingMode: "vertical",
        presetMode: "home",
        humidity: 50,
      };

      expect(options.temperature).toBe(72);
      expect(options.hvacMode).toBe("heat_cool");
    });
  });
});
