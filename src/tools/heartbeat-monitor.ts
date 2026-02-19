/**
 * Heartbeat Monitor
 * Track service health with periodic heartbeats
 */

export interface HeartbeatService {
  id: string;
  name: string;
  intervalMs: number;
  lastBeat: number | null;
  status: "healthy" | "degraded" | "down" | "unknown";
  consecutiveMisses: number;
  metadata?: Record<string, unknown>;
}

export interface HeartbeatResult {
  success: boolean;
  service?: HeartbeatService;
  services?: HeartbeatService[];
  error?: string;
}

// In-memory store of registered services
const services = new Map<string, HeartbeatService>();

// Register a new service to monitor
export function registerService(
  id: string,
  name: string,
  intervalMs: number = 60000,
  metadata?: Record<string, unknown>
): HeartbeatResult {
  if (services.has(id)) {
    return { success: false, error: `Service '${id}' already registered` };
  }

  const service: HeartbeatService = {
    id,
    name,
    intervalMs,
    lastBeat: null,
    status: "unknown",
    consecutiveMisses: 0,
    metadata,
  };

  services.set(id, service);
  return { success: true, service };
}

// Record a heartbeat for a service
export function recordBeat(id: string): HeartbeatResult {
  const service = services.get(id);
  if (!service) {
    return { success: false, error: `Service '${id}' not found` };
  }

  service.lastBeat = Date.now();
  service.consecutiveMisses = 0;
  service.status = "healthy";
  services.set(id, service);

  return { success: true, service };
}

// Check all services for missed heartbeats
export function checkHeartbeats(): HeartbeatResult {
  const now = Date.now();
  const results: HeartbeatService[] = [];

  for (const [, service] of services) {
    if (service.lastBeat === null) {
      service.status = "unknown";
    } else {
      const elapsed = now - service.lastBeat;
      if (elapsed > service.intervalMs * 3) {
        service.status = "down";
        service.consecutiveMisses = Math.floor(elapsed / service.intervalMs);
      } else if (elapsed > service.intervalMs * 1.5) {
        service.status = "degraded";
        service.consecutiveMisses = Math.floor(elapsed / service.intervalMs);
      } else {
        service.status = "healthy";
        service.consecutiveMisses = 0;
      }
    }
    results.push({ ...service });
  }

  return { success: true, services: results };
}

// Remove a service from monitoring
export function unregisterService(id: string): HeartbeatResult {
  if (!services.has(id)) {
    return { success: false, error: `Service '${id}' not found` };
  }

  services.delete(id);
  return { success: true };
}

// Get status of a specific service
export function getServiceStatus(id: string): HeartbeatResult {
  const service = services.get(id);
  if (!service) {
    return { success: false, error: `Service '${id}' not found` };
  }

  return { success: true, service: { ...service } };
}

// Get summary stats
export function getHeartbeatSummary(): {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
} {
  let healthy = 0, degraded = 0, down = 0, unknown = 0;

  // Refresh statuses first
  checkHeartbeats();

  for (const [, service] of services) {
    switch (service.status) {
      case "healthy": healthy++; break;
      case "degraded": degraded++; break;
      case "down": down++; break;
      default: unknown++; break;
    }
  }

  return { total: services.size, healthy, degraded, down, unknown };
}

// Reset all services (for testing)
export function resetAll(): void {
  services.clear();
}

export default {
  registerService,
  recordBeat,
  checkHeartbeats,
  unregisterService,
  getServiceStatus,
  getHeartbeatSummary,
  resetAll,
};
