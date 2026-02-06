// Authentication monitoring and anomaly detection

import { logAudit, getRecentUserActivity } from "./audit-logger";

export interface LoginAttempt {
  userId: string;
  success: boolean;
  ipAddress?: string;
  deviceInfo?: string;
  timestamp: Date;
  platform?: string;
}

export type AlertLevel = "info" | "warning" | "critical";

export interface AuthAnomaly {
  type:
    | "brute_force"
    | "new_device"
    | "new_ip"
    | "impossible_travel"
    | "unusual_time"
    | "rapid_session_switching";
  level: AlertLevel;
  message: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

// In-memory stores for tracking
const loginHistory: Map<string, LoginAttempt[]> = new Map();
const knownDevices: Map<string, Set<string>> = new Map();
const knownIPs: Map<string, Set<string>> = new Map();
const userLoginHours: Map<string, number[]> = new Map();

// Anomaly alert callbacks
type AlertCallback = (userId: string, anomaly: AuthAnomaly) => Promise<void>;
const alertCallbacks: AlertCallback[] = [];

export class AuthMonitor {
  // Max attempts tracked per user
  private maxHistorySize = 200;
  // Brute force: failed attempts threshold in window
  private bruteForceThreshold = 5;
  private bruteForceWindowMs = 10 * 60 * 1000; // 10 minutes
  // Rapid session switching threshold
  private rapidSwitchThreshold = 5;
  private rapidSwitchWindowMs = 5 * 60 * 1000; // 5 minutes

  onAlert(callback: AlertCallback): void {
    alertCallbacks.push(callback);
  }

  async recordLoginAttempt(attempt: LoginAttempt): Promise<AuthAnomaly[]> {
    const { userId } = attempt;

    // Store in history
    if (!loginHistory.has(userId)) {
      loginHistory.set(userId, []);
    }
    const history = loginHistory.get(userId)!;
    history.push(attempt);
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }

    // Run anomaly checks
    const anomalies = await this.checkForAnomalies(userId, attempt);

    // Log the attempt
    try {
      await logAudit({
        userId,
        action: attempt.success ? "login_success" as any : "login_failed" as any,
        details: {
          ipAddress: attempt.ipAddress,
          deviceInfo: attempt.deviceInfo,
          platform: attempt.platform,
          anomalies: anomalies.length > 0 ? anomalies : undefined,
        },
      });
    } catch {
      // Audit logging failure shouldn't block auth flow
    }

    // Fire alert callbacks
    for (const anomaly of anomalies) {
      for (const callback of alertCallbacks) {
        try {
          await callback(userId, anomaly);
        } catch {
          // Don't let callback failures block
        }
      }
    }

    // Track known devices/IPs for this user if successful
    if (attempt.success) {
      if (attempt.deviceInfo) {
        if (!knownDevices.has(userId)) knownDevices.set(userId, new Set());
        knownDevices.get(userId)!.add(attempt.deviceInfo);
      }
      if (attempt.ipAddress) {
        if (!knownIPs.has(userId)) knownIPs.set(userId, new Set());
        knownIPs.get(userId)!.add(attempt.ipAddress);
      }
      // Track login hours
      const hour = attempt.timestamp.getHours();
      if (!userLoginHours.has(userId)) userLoginHours.set(userId, []);
      userLoginHours.get(userId)!.push(hour);
    }

    return anomalies;
  }

  async checkForAnomalies(
    userId: string,
    currentAttempt?: LoginAttempt
  ): Promise<AuthAnomaly[]> {
    const anomalies: AuthAnomaly[] = [];
    const history = loginHistory.get(userId) ?? [];
    const now = currentAttempt?.timestamp ?? new Date();

    // 1. Brute force detection
    const recentFailed = history.filter(
      (a) =>
        !a.success &&
        now.getTime() - a.timestamp.getTime() < this.bruteForceWindowMs
    );
    if (recentFailed.length >= this.bruteForceThreshold) {
      anomalies.push({
        type: "brute_force",
        level: "critical",
        message: `${recentFailed.length} failed login attempts in the last 10 minutes`,
        details: {
          failedCount: recentFailed.length,
          windowMinutes: this.bruteForceWindowMs / 60000,
          ips: [...new Set(recentFailed.map((a) => a.ipAddress).filter(Boolean))],
        },
        timestamp: now,
      });
    }

    // 2. New device detection
    if (currentAttempt?.deviceInfo && currentAttempt.success) {
      const known = knownDevices.get(userId);
      if (known && known.size > 0 && !known.has(currentAttempt.deviceInfo)) {
        anomalies.push({
          type: "new_device",
          level: "warning",
          message: `Login from new device: ${currentAttempt.deviceInfo}`,
          details: {
            newDevice: currentAttempt.deviceInfo,
            knownDeviceCount: known.size,
          },
          timestamp: now,
        });
      }
    }

    // 3. New IP detection
    if (currentAttempt?.ipAddress && currentAttempt.success) {
      const known = knownIPs.get(userId);
      if (known && known.size > 0 && !known.has(currentAttempt.ipAddress)) {
        anomalies.push({
          type: "new_ip",
          level: "info",
          message: `Login from new IP address: ${currentAttempt.ipAddress}`,
          details: {
            newIP: currentAttempt.ipAddress,
            knownIPCount: known.size,
          },
          timestamp: now,
        });
      }
    }

    // 4. Unusual time detection
    if (currentAttempt?.success) {
      const hours = userLoginHours.get(userId);
      if (hours && hours.length >= 20) {
        const currentHour = now.getHours();
        const hourFreq = hours.reduce(
          (acc, h) => {
            acc[h] = (acc[h] || 0) + 1;
            return acc;
          },
          {} as Record<number, number>
        );
        const totalLogins = hours.length;
        const currentHourFreq = hourFreq[currentHour] || 0;
        const ratio = currentHourFreq / totalLogins;

        // If this hour accounts for less than 2% of logins, it's unusual
        if (ratio < 0.02) {
          anomalies.push({
            type: "unusual_time",
            level: "info",
            message: `Login at unusual hour: ${currentHour}:00 (rarely used)`,
            details: {
              hour: currentHour,
              historicalFrequency: ratio,
              totalTrackedLogins: totalLogins,
            },
            timestamp: now,
          });
        }
      }
    }

    // 5. Rapid session switching
    const recentSuccessful = history.filter(
      (a) =>
        a.success &&
        now.getTime() - a.timestamp.getTime() < this.rapidSwitchWindowMs
    );
    if (recentSuccessful.length >= this.rapidSwitchThreshold) {
      anomalies.push({
        type: "rapid_session_switching",
        level: "warning",
        message: `${recentSuccessful.length} login sessions in the last 5 minutes`,
        details: {
          sessionCount: recentSuccessful.length,
          windowMinutes: this.rapidSwitchWindowMs / 60000,
        },
        timestamp: now,
      });
    }

    // 6. Impossible travel detection
    if (currentAttempt?.ipAddress && currentAttempt.success) {
      const lastSuccessful = history
        .filter(
          (a) =>
            a.success &&
            a.ipAddress &&
            a.ipAddress !== currentAttempt.ipAddress &&
            a !== currentAttempt
        )
        .pop();

      if (lastSuccessful) {
        const timeDiffMs =
          now.getTime() - lastSuccessful.timestamp.getTime();
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

        // If different IP within 30 minutes, flag it
        if (timeDiffHours < 0.5 && lastSuccessful.ipAddress !== currentAttempt.ipAddress) {
          anomalies.push({
            type: "impossible_travel",
            level: "warning",
            message: `IP changed from ${lastSuccessful.ipAddress} to ${currentAttempt.ipAddress} in ${Math.round(timeDiffHours * 60)} minutes`,
            details: {
              previousIP: lastSuccessful.ipAddress,
              currentIP: currentAttempt.ipAddress,
              timeDiffMinutes: Math.round(timeDiffHours * 60),
            },
            timestamp: now,
          });
        }
      }
    }

    return anomalies;
  }

  getLoginHistory(
    userId: string,
    days: number = 30
  ): LoginAttempt[] {
    const history = loginHistory.get(userId) ?? [];
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return history.filter((a) => a.timestamp.getTime() > cutoff);
  }

  getKnownDevices(userId: string): string[] {
    return [...(knownDevices.get(userId) ?? [])];
  }

  getKnownIPs(userId: string): string[] {
    return [...(knownIPs.get(userId) ?? [])];
  }

  clearHistory(userId: string): void {
    loginHistory.delete(userId);
    knownDevices.delete(userId);
    knownIPs.delete(userId);
    userLoginHours.delete(userId);
  }
}

// Singleton
export const authMonitor = new AuthMonitor();
