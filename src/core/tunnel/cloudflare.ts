import type { TunnelProvider } from "./types";

export class CloudflareTunnel implements TunnelProvider {
  readonly name = "cloudflare";

  private process: ReturnType<typeof Bun.spawn> | null = null;
  private publicUrl: string | null = null;
  private running = false;

  async start(port: number): Promise<string> {
    if (this.running) {
      throw new Error("Cloudflare tunnel is already running");
    }

    const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stop().catch(() => {});
        reject(
          new Error(
            "Timed out waiting for Cloudflare tunnel URL (15s). Is cloudflared installed?"
          )
        );
      }, 15_000);

      try {
        this.process = Bun.spawn(
          ["cloudflared", "tunnel", "--url", `http://localhost:${port}`],
          {
            stdout: "pipe",
            stderr: "pipe",
          }
        );

        this.running = true;

        // cloudflared outputs the URL on stderr
        const readStderr = async () => {
          if (!this.process?.stderr) return;

          const reader = this.process.stderr.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              const match = buffer.match(urlPattern);
              if (match) {
                this.publicUrl = match[0];
                clearTimeout(timeout);
                resolve(this.publicUrl);
                return;
              }
            }
          } catch {
            // Process may have been killed; ignore read errors
          }
        };

        // Also check stdout in case cloudflared version outputs there
        const readStdout = async () => {
          if (!this.process?.stdout) return;

          const reader = this.process.stdout.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              const match = buffer.match(urlPattern);
              if (match && !this.publicUrl) {
                this.publicUrl = match[0];
                clearTimeout(timeout);
                resolve(this.publicUrl);
                return;
              }
            }
          } catch {
            // Process may have been killed; ignore read errors
          }
        };

        readStderr();
        readStdout();

        // Handle process exit before URL is found
        this.process.exited.then((code) => {
          if (!this.publicUrl) {
            this.running = false;
            clearTimeout(timeout);
            reject(
              new Error(`cloudflared exited with code ${code} before providing a URL`)
            );
          }
        });
      } catch (err: any) {
        clearTimeout(timeout);
        this.running = false;
        reject(new Error(`Failed to spawn cloudflared: ${err.message}`));
      }
    });
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
