import type { TunnelProvider } from "./types";

interface NgrokApiTunnel {
  public_url: string;
  proto: string;
  config: { addr: string };
}

interface NgrokApiResponse {
  tunnels: NgrokApiTunnel[];
}

export class NgrokTunnel implements TunnelProvider {
  readonly name = "ngrok";

  private process: ReturnType<typeof Bun.spawn> | null = null;
  private publicUrl: string | null = null;
  private running = false;
  private authToken?: string;

  constructor(authToken?: string) {
    this.authToken = authToken;
  }

  async start(port: number): Promise<string> {
    if (this.running) {
      throw new Error("ngrok tunnel is already running");
    }

    const args = ["ngrok", "http", String(port)];
    if (this.authToken) {
      args.push("--authtoken", this.authToken);
    }

    try {
      this.process = Bun.spawn(args, {
        stdout: "pipe",
        stderr: "pipe",
      });
      this.running = true;
    } catch (err: any) {
      throw new Error(`Failed to spawn ngrok: ${err.message}`);
    }

    // Handle unexpected early exit
    this.process.exited.then((code) => {
      if (this.running) {
        this.running = false;
        console.warn(`[Tunnel] ngrok exited unexpectedly with code ${code}`);
      }
    });

    // Poll the ngrok local API to get the public URL
    const url = await this.pollForUrl(5, 1000);
    if (!url) {
      await this.stop();
      throw new Error(
        "Failed to retrieve ngrok public URL after 5 retries. Is ngrok installed and working?"
      );
    }

    this.publicUrl = url;
    return this.publicUrl;
  }

  private async pollForUrl(
    maxRetries: number,
    delayMs: number
  ): Promise<string | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await this.sleep(delayMs);

      try {
        const response = await fetch("http://localhost:4040/api/tunnels");
        if (!response.ok) continue;

        const data = (await response.json()) as NgrokApiResponse;
        const httpsTunnel = data.tunnels.find((t) => t.proto === "https");
        const tunnel = httpsTunnel || data.tunnels[0];

        if (tunnel?.public_url) {
          return tunnel.public_url;
        }
      } catch {
        // ngrok API not ready yet; retry
      }
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    if (this.process) {
      try {
        this.process.kill();
        await this.process.exited;
      } catch {
        // Process may already be dead
      }
      this.process = null;
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
