export interface TunnelProvider {
  readonly name: string;
  start(port: number): Promise<string>; // returns public URL
  stop(): Promise<void>;
  getPublicUrl(): string | null;
  isRunning(): boolean;
}
