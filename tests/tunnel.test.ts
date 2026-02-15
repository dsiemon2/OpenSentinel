import { describe, test, expect } from "bun:test";
import { createTunnel, getActiveTunnel } from "../src/core/tunnel";
import { CloudflareTunnel } from "../src/core/tunnel/cloudflare";
import { NgrokTunnel } from "../src/core/tunnel/ngrok";
import { LocalTunnel } from "../src/core/tunnel/localtunnel";

describe("Tunnel System", () => {
  describe("createTunnel factory", () => {
    test("createTunnel('cloudflare') returns CloudflareTunnel instance", () => {
      const tunnel = createTunnel("cloudflare");
      expect(tunnel).toBeInstanceOf(CloudflareTunnel);
    });

    test("createTunnel('ngrok') returns NgrokTunnel instance", () => {
      const tunnel = createTunnel("ngrok");
      expect(tunnel).toBeInstanceOf(NgrokTunnel);
    });

    test("createTunnel('localtunnel') returns LocalTunnel instance", () => {
      const tunnel = createTunnel("localtunnel");
      expect(tunnel).toBeInstanceOf(LocalTunnel);
    });

    test("createTunnel('unknown') throws error", () => {
      expect(() => createTunnel("unknown")).toThrow(
        "Unknown tunnel provider: unknown"
      );
    });
  });

  describe("CloudflareTunnel", () => {
    test("name is 'cloudflare'", () => {
      const tunnel = new CloudflareTunnel();
      expect(tunnel.name).toBe("cloudflare");
    });

    test("isRunning() is false initially", () => {
      const tunnel = new CloudflareTunnel();
      expect(tunnel.isRunning()).toBe(false);
    });

    test("getPublicUrl() is null initially", () => {
      const tunnel = new CloudflareTunnel();
      expect(tunnel.getPublicUrl()).toBeNull();
    });
  });

  describe("NgrokTunnel", () => {
    test("name is 'ngrok'", () => {
      const tunnel = new NgrokTunnel();
      expect(tunnel.name).toBe("ngrok");
    });

    test("isRunning() is false initially", () => {
      const tunnel = new NgrokTunnel();
      expect(tunnel.isRunning()).toBe(false);
    });

    test("getPublicUrl() is null initially", () => {
      const tunnel = new NgrokTunnel();
      expect(tunnel.getPublicUrl()).toBeNull();
    });
  });

  describe("LocalTunnel", () => {
    test("name is 'localtunnel'", () => {
      const tunnel = new LocalTunnel();
      expect(tunnel.name).toBe("localtunnel");
    });

    test("isRunning() is false initially", () => {
      const tunnel = new LocalTunnel();
      expect(tunnel.isRunning()).toBe(false);
    });

    test("getPublicUrl() is null initially", () => {
      const tunnel = new LocalTunnel();
      expect(tunnel.getPublicUrl()).toBeNull();
    });
  });

  describe("TunnelProvider interface", () => {
    test("all providers implement start, stop, getPublicUrl, and isRunning methods", () => {
      const providers = [
        new CloudflareTunnel(),
        new NgrokTunnel(),
        new LocalTunnel(),
      ];

      for (const provider of providers) {
        expect(typeof provider.start).toBe("function");
        expect(typeof provider.stop).toBe("function");
        expect(typeof provider.getPublicUrl).toBe("function");
        expect(typeof provider.isRunning).toBe("function");
        expect(typeof provider.name).toBe("string");
      }
    });
  });

  describe("getActiveTunnel", () => {
    test("returns null when no tunnel has been started", () => {
      const active = getActiveTunnel();
      expect(active).toBeNull();
    });
  });
});
