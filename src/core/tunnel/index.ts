import type { TunnelProvider } from "./types";
import { CloudflareTunnel } from "./cloudflare";
import { NgrokTunnel } from "./ngrok";
import { LocalTunnel } from "./localtunnel";

export function createTunnel(
  provider: string,
  options?: { authToken?: string; subdomain?: string }
): TunnelProvider {
  switch (provider) {
    case "cloudflare":
      return new CloudflareTunnel();
    case "ngrok":
      return new NgrokTunnel(options?.authToken);
    case "localtunnel":
      return new LocalTunnel(options?.subdomain);
    default:
      throw new Error(`Unknown tunnel provider: ${provider}`);
  }
}

let activeTunnel: TunnelProvider | null = null;

export async function autoStartTunnel(
  port: number,
  provider: string,
  options?: { authToken?: string; subdomain?: string }
): Promise<string | null> {
  try {
    activeTunnel = createTunnel(provider, options);
    const url = await activeTunnel.start(port);
    console.log(`[Tunnel] Public URL: ${url}`);
    return url;
  } catch (err: any) {
    console.warn(`[Tunnel] Failed to start ${provider}: ${err.message}`);
    activeTunnel = null;
    return null;
  }
}

export async function stopTunnel(): Promise<void> {
  if (activeTunnel) {
    await activeTunnel.stop();
    activeTunnel = null;
  }
}

export function getActiveTunnel(): TunnelProvider | null {
  return activeTunnel;
}

export type { TunnelProvider } from "./types";
