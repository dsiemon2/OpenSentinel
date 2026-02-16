import type { TunnelProvider } from "./types";

interface LocalTunnelInstance {
  url: string;
  close(): void;
  on(event: string, callback: (...args: any[]) => void): void;
}

type LocalTunnelFactory = (opts: {
  port: number;
  subdomain?: string;
}) => Promise<LocalTunnelInstance>;

export class LocalTunnel implements TunnelProvider {
  readonly name = "localtunnel";

  private tunnel: LocalTunnelInstance | null = null;
  private publicUrl: string | null = null;
  private running = false;
  private subdomain?: string;

  constructor(subdomain?: string) {
    this.subdomain = subdomain;
  }

  async start(port: number): Promise<string> {
    if (this.running) {
      throw new Error("localtunnel is already running");
    }

    let localtunnel: LocalTunnelFactory;

    try {
      // Dynamic import for lazy loading - localtunnel may not be installed
      const mod = await import("localtunnel");
      localtunnel = (mod.default || mod) as LocalTunnelFactory;
    } catch {
      throw new Error(
        'localtunnel is not installed. Run "bun add localtunnel" to install it.'
      );
    }

    const opts: { port: number; subdomain?: string } = { port };
    if (this.subdomain) {
      opts.subdomain = this.subdomain;
    }

    try {
      this.tunnel = await localtunnel(opts);
    } catch (err: any) {
      throw new Error(`Failed to create localtunnel: ${err.message}`);
    }

    this.publicUrl = this.tunnel.url;
    this.running = true;

    // Listen for tunnel close events
    this.tunnel.on("close", () => {
      this.running = false;
      this.publicUrl = null;
    });

    // Listen for errors
    this.tunnel.on("error", (err: Error) => {
      console.warn(`[Tunnel] localtunnel error: ${err.message}`);
      this.running = false;
      this.publicUrl = null;
    });

    return this.publicUrl;
  }

  async stop(): Promise<void> {
    if (this.tunnel) {
      try {
        this.tunnel.close();
      } catch {
        // Tunnel may already be closed
      }
      this.tunnel = null;
    }
    this.running = false;
    this.publicUrl = null;
  }

  getPublicUrl(): string | null {
    return this.publicUrl;
  }

  isRunning(): boolean {
    return this.running;
  }
}
