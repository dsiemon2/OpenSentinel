/**
 * OpenSentinel Stop Command
 *
 * Stops the system service.
 */

import { exec, colors } from "./utils";
import { homedir } from "node:os";
import { join } from "node:path";

export default async function stop() {
  const platform = process.platform;

  if (platform === "linux") {
    const result = await exec("sudo systemctl stop opensentinel", { throws: false });
    if (result.exitCode === 0) {
      console.log(`${colors.green}OpenSentinel stopped.${colors.reset}`);
    } else {
      // Try killing the process directly
      await exec("pkill -f 'opensentinel start' 2>/dev/null || pkill -f 'bun.*cli.ts' 2>/dev/null", { throws: false });
      console.log(`${colors.green}OpenSentinel stopped.${colors.reset}`);
    }
  } else if (platform === "darwin") {
    const plistPath = join(homedir(), "Library", "LaunchAgents", "ai.opensentinel.daemon.plist");
    const result = await exec(`launchctl unload ${plistPath} 2>/dev/null`, { throws: false });
    if (result.exitCode === 0) {
      console.log(`${colors.green}OpenSentinel stopped.${colors.reset}`);
    } else {
      await exec("pkill -f 'opensentinel start' 2>/dev/null", { throws: false });
      console.log(`${colors.green}OpenSentinel stopped.${colors.reset}`);
    }
  } else {
    await exec("pkill -f 'opensentinel start' 2>/dev/null || pkill -f 'bun.*cli.ts' 2>/dev/null", { throws: false });
    console.log(`${colors.green}OpenSentinel stopped.${colors.reset}`);
  }
}
