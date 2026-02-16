/**
 * CLI command to display/regenerate pairing code
 */
import { pairingManager } from "../core/security/pairing";

export function showPairingInfo(): void {
  const code = pairingManager.getActiveCode() || pairingManager.generateCode();
  const stats = pairingManager.getStats();

  console.log("\n╔══════════════════════════════╗");
  console.log("║      DEVICE PAIRING          ║");
  console.log("╠══════════════════════════════╣");
  console.log(`║  Code: ${code}                ║`);
  console.log(`║  Devices: ${String(stats.deviceCount).padEnd(17)}║`);
  console.log("╚══════════════════════════════╝\n");
}

export function regeneratePairingCode(): string {
  return pairingManager.generateCode();
}
