import { db } from "../../db";
import { sql } from "drizzle-orm";
import Redis from "ioredis";
import { env } from "../../config/env";

// Redis connection check
let redis: Redis | null = null;
try {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 5000,
  });
} catch {
  console.warn("[K8s] Redis connection not available");
}

// ============================================
// TYPES
// ============================================

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  version: string;
  uptime: number;
  checks: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  lastCheck: Date;
  details?: Record<string, unknown>;
}

export interface ReadinessCheckResult {
  ready: boolean;
  checks: Record<string, boolean>;
  message?: string;
}

export interface LivenessCheckResult {
  alive: boolean;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

export interface K8sMetadata {
  podName: string;
  namespace: string;
  nodeName?: string;
  podIP?: string;
  serviceAccount?: string;
  labels?: Record<string, string>;
}

export interface K8sConfig {
  replicas: {
    min: number;
    max: number;
    targetCPU: number;
    targetMemory: number;
  };
  resources: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
  probes: {
    liveness: ProbeConfig;
    readiness: ProbeConfig;
    startup?: ProbeConfig;
  };
}

export interface ProbeConfig {
  path: string;
  port: number;
  initialDelaySeconds: number;
  periodSeconds: number;
  timeoutSeconds: number;
  successThreshold: number;
  failureThreshold: number;
}

// ============================================
// HEALTH CHECKS
// ============================================

const startTime = Date.now();

/**
 * Comprehensive health check for Kubernetes
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const checks: Record<string, ComponentHealth> = {};

  // Database health
  checks.database = await checkDatabase();

  // Redis health
  checks.redis = await checkRedis();

  // Memory check
  checks.memory = checkMemory();

  // External services
  checks.claude = await checkClaudeAPI();

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  let overallStatus: HealthStatus = "healthy";

  if (statuses.some((s) => s === "unhealthy")) {
    overallStatus = "unhealthy";
  } else if (statuses.some((s) => s === "degraded")) {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    timestamp: new Date(),
    version: process.env.APP_VERSION || "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };
}

/**
 * Kubernetes liveness probe
 * Returns true if the application is running
 */
export async function livenessCheck(): Promise<LivenessCheckResult> {
  return {
    alive: true,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
  };
}

/**
 * Kubernetes readiness probe
 * Returns true if the application can accept traffic
 */
export async function readinessCheck(): Promise<ReadinessCheckResult> {
  const checks: Record<string, boolean> = {};

  // Check database connection
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check Redis connection
  if (redis) {
    try {
      await redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }
  } else {
    checks.redis = true; // Redis is optional
  }

  const ready = Object.values(checks).every((c) => c);

  return {
    ready,
    checks,
    message: ready ? "All systems operational" : "Some systems unavailable",
  };
}

/**
 * Kubernetes startup probe
 * Returns true once the application has fully started
 */
export async function startupCheck(): Promise<{ started: boolean; message: string }> {
  try {
    // Verify database migrations are complete
    const migrationCheck = await db.execute(
      sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')`
    ) as unknown as { rows: any[] };

    const tablesExist = (migrationCheck.rows[0] as any).exists;

    if (!tablesExist) {
      return { started: false, message: "Database migrations not complete" };
    }

    return { started: true, message: "Application started successfully" };
  } catch (error) {
    return {
      started: false,
      message: error instanceof Error ? error.message : "Startup check failed",
    };
  }
}

// ============================================
// COMPONENT HEALTH CHECKS
// ============================================

async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    await db.execute(sql`SELECT 1`);
    const latencyMs = Date.now() - start;

    // Check connection pool status
    const poolResult = await db.execute(sql`
      SELECT count(*) as connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `) as unknown as { rows: any[] };

    const connections = parseInt((poolResult.rows[0] as any).connections, 10);

    return {
      status: latencyMs < 100 ? "healthy" : latencyMs < 500 ? "degraded" : "unhealthy",
      latencyMs,
      lastCheck: new Date(),
      details: {
        connections,
        maxConnections: 100, // Typical default
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Database check failed",
      lastCheck: new Date(),
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  if (!redis) {
    return {
      status: "healthy",
      message: "Redis not configured (optional)",
      lastCheck: new Date(),
    };
  }

  const start = Date.now();

  try {
    await redis.ping();
    const latencyMs = Date.now() - start;

    const info = await redis.info("memory");
    const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || "0", 10);

    return {
      status: latencyMs < 50 ? "healthy" : latencyMs < 200 ? "degraded" : "unhealthy",
      latencyMs,
      lastCheck: new Date(),
      details: {
        usedMemoryBytes: usedMemory,
        usedMemoryMB: Math.round(usedMemory / 1024 / 1024),
      },
    };
  } catch (error) {
    return {
      status: "degraded", // Redis is optional, so degraded not unhealthy
      message: error instanceof Error ? error.message : "Redis check failed",
      lastCheck: new Date(),
    };
  }
}

function checkMemory(): ComponentHealth {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const heapPercentage = (usage.heapUsed / usage.heapTotal) * 100;

  let status: HealthStatus = "healthy";
  if (heapPercentage > 90) {
    status = "unhealthy";
  } else if (heapPercentage > 75) {
    status = "degraded";
  }

  return {
    status,
    lastCheck: new Date(),
    details: {
      heapUsedMB,
      heapTotalMB,
      heapPercentage: Math.round(heapPercentage),
      rssMB: Math.round(usage.rss / 1024 / 1024),
      externalMB: Math.round(usage.external / 1024 / 1024),
    },
  };
}

async function checkClaudeAPI(): Promise<ComponentHealth> {
  // Simple check - just verify the API key is configured
  // Full API check would consume tokens
  const hasApiKey = !!env.CLAUDE_API_KEY && env.CLAUDE_API_KEY.length > 10;

  return {
    status: hasApiKey ? "healthy" : "unhealthy",
    message: hasApiKey ? "API key configured" : "API key not configured",
    lastCheck: new Date(),
  };
}

// ============================================
// KUBERNETES METADATA
// ============================================

/**
 * Get Kubernetes pod metadata from environment
 */
export function getK8sMetadata(): K8sMetadata {
  return {
    podName: process.env.HOSTNAME || process.env.POD_NAME || "unknown",
    namespace: process.env.POD_NAMESPACE || "default",
    nodeName: process.env.NODE_NAME,
    podIP: process.env.POD_IP,
    serviceAccount: process.env.SERVICE_ACCOUNT,
    labels: {
      app: "sentinel",
      version: process.env.APP_VERSION || "1.0.0",
      environment: env.NODE_ENV,
    },
  };
}

/**
 * Check if running in Kubernetes
 */
export function isRunningInK8s(): boolean {
  return !!(
    process.env.KUBERNETES_SERVICE_HOST ||
    process.env.KUBERNETES_PORT ||
    process.env.POD_NAME
  );
}

// ============================================
// KUBERNETES MANIFEST GENERATORS
// ============================================

/**
 * Generate recommended Kubernetes deployment configuration
 */
export function generateDeploymentConfig(
  name: string = "sentinel",
  namespace: string = "default",
  config?: Partial<K8sConfig>
): Record<string, unknown> {
  const defaultConfig: K8sConfig = {
    replicas: {
      min: 2,
      max: 10,
      targetCPU: 70,
      targetMemory: 80,
    },
    resources: {
      requests: { cpu: "250m", memory: "512Mi" },
      limits: { cpu: "1000m", memory: "2Gi" },
    },
    probes: {
      liveness: {
        path: "/api/health/live",
        port: 8030,
        initialDelaySeconds: 10,
        periodSeconds: 10,
        timeoutSeconds: 5,
        successThreshold: 1,
        failureThreshold: 3,
      },
      readiness: {
        path: "/api/health/ready",
        port: 8030,
        initialDelaySeconds: 5,
        periodSeconds: 5,
        timeoutSeconds: 3,
        successThreshold: 1,
        failureThreshold: 3,
      },
      startup: {
        path: "/api/health/startup",
        port: 8030,
        initialDelaySeconds: 0,
        periodSeconds: 5,
        timeoutSeconds: 5,
        successThreshold: 1,
        failureThreshold: 30,
      },
    },
  };

  const mergedConfig = {
    ...defaultConfig,
    ...config,
    replicas: { ...defaultConfig.replicas, ...config?.replicas },
    resources: { ...defaultConfig.resources, ...config?.resources },
    probes: { ...defaultConfig.probes, ...config?.probes },
  };

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace,
      labels: {
        app: name,
        "app.kubernetes.io/name": name,
        "app.kubernetes.io/version": process.env.APP_VERSION || "1.0.0",
      },
    },
    spec: {
      replicas: mergedConfig.replicas.min,
      selector: {
        matchLabels: { app: name },
      },
      template: {
        metadata: {
          labels: {
            app: name,
            "app.kubernetes.io/name": name,
          },
          annotations: {
            "prometheus.io/scrape": "true",
            "prometheus.io/port": "8030",
            "prometheus.io/path": "/api/metrics",
          },
        },
        spec: {
          serviceAccountName: `${name}-sa`,
          securityContext: {
            runAsNonRoot: true,
            runAsUser: 1000,
            fsGroup: 1000,
          },
          containers: [
            {
              name,
              image: `sentinel:${process.env.APP_VERSION || "latest"}`,
              imagePullPolicy: "Always",
              ports: [{ containerPort: 8030, name: "http" }],
              resources: mergedConfig.resources,
              env: [
                { name: "NODE_ENV", value: "production" },
                { name: "POD_NAME", valueFrom: { fieldRef: { fieldPath: "metadata.name" } } },
                { name: "POD_NAMESPACE", valueFrom: { fieldRef: { fieldPath: "metadata.namespace" } } },
                { name: "POD_IP", valueFrom: { fieldRef: { fieldPath: "status.podIP" } } },
                { name: "NODE_NAME", valueFrom: { fieldRef: { fieldPath: "spec.nodeName" } } },
              ],
              envFrom: [
                { secretRef: { name: `${name}-secrets` } },
                { configMapRef: { name: `${name}-config` } },
              ],
              livenessProbe: {
                httpGet: { path: mergedConfig.probes.liveness.path, port: "http" },
                initialDelaySeconds: mergedConfig.probes.liveness.initialDelaySeconds,
                periodSeconds: mergedConfig.probes.liveness.periodSeconds,
                timeoutSeconds: mergedConfig.probes.liveness.timeoutSeconds,
                failureThreshold: mergedConfig.probes.liveness.failureThreshold,
              },
              readinessProbe: {
                httpGet: { path: mergedConfig.probes.readiness.path, port: "http" },
                initialDelaySeconds: mergedConfig.probes.readiness.initialDelaySeconds,
                periodSeconds: mergedConfig.probes.readiness.periodSeconds,
                timeoutSeconds: mergedConfig.probes.readiness.timeoutSeconds,
                failureThreshold: mergedConfig.probes.readiness.failureThreshold,
              },
              startupProbe: mergedConfig.probes.startup
                ? {
                    httpGet: { path: mergedConfig.probes.startup.path, port: "http" },
                    initialDelaySeconds: mergedConfig.probes.startup.initialDelaySeconds,
                    periodSeconds: mergedConfig.probes.startup.periodSeconds,
                    timeoutSeconds: mergedConfig.probes.startup.timeoutSeconds,
                    failureThreshold: mergedConfig.probes.startup.failureThreshold,
                  }
                : undefined,
              volumeMounts: [
                { name: "tmp", mountPath: "/tmp" },
                { name: "data", mountPath: "/data" },
              ],
            },
          ],
          volumes: [
            { name: "tmp", emptyDir: {} },
            { name: "data", persistentVolumeClaim: { claimName: `${name}-data` } },
          ],
          affinity: {
            podAntiAffinity: {
              preferredDuringSchedulingIgnoredDuringExecution: [
                {
                  weight: 100,
                  podAffinityTerm: {
                    labelSelector: { matchLabels: { app: name } },
                    topologyKey: "kubernetes.io/hostname",
                  },
                },
              ],
            },
          },
          topologySpreadConstraints: [
            {
              maxSkew: 1,
              topologyKey: "topology.kubernetes.io/zone",
              whenUnsatisfiable: "ScheduleAnyway",
              labelSelector: { matchLabels: { app: name } },
            },
          ],
        },
      },
    },
  };
}

/**
 * Generate HorizontalPodAutoscaler configuration
 */
export function generateHPAConfig(
  name: string = "sentinel",
  namespace: string = "default",
  config?: Partial<K8sConfig["replicas"]>
): Record<string, unknown> {
  const defaults = {
    min: 2,
    max: 10,
    targetCPU: 70,
    targetMemory: 80,
  };

  const merged = { ...defaults, ...config };

  return {
    apiVersion: "autoscaling/v2",
    kind: "HorizontalPodAutoscaler",
    metadata: {
      name,
      namespace,
    },
    spec: {
      scaleTargetRef: {
        apiVersion: "apps/v1",
        kind: "Deployment",
        name,
      },
      minReplicas: merged.min,
      maxReplicas: merged.max,
      metrics: [
        {
          type: "Resource",
          resource: {
            name: "cpu",
            target: {
              type: "Utilization",
              averageUtilization: merged.targetCPU,
            },
          },
        },
        {
          type: "Resource",
          resource: {
            name: "memory",
            target: {
              type: "Utilization",
              averageUtilization: merged.targetMemory,
            },
          },
        },
      ],
      behavior: {
        scaleDown: {
          stabilizationWindowSeconds: 300,
          policies: [
            { type: "Percent", value: 10, periodSeconds: 60 },
            { type: "Pods", value: 1, periodSeconds: 60 },
          ],
          selectPolicy: "Min",
        },
        scaleUp: {
          stabilizationWindowSeconds: 60,
          policies: [
            { type: "Percent", value: 100, periodSeconds: 15 },
            { type: "Pods", value: 4, periodSeconds: 15 },
          ],
          selectPolicy: "Max",
        },
      },
    },
  };
}

/**
 * Generate Service configuration
 */
export function generateServiceConfig(
  name: string = "sentinel",
  namespace: string = "default"
): Record<string, unknown> {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name,
      namespace,
      labels: { app: name },
    },
    spec: {
      type: "ClusterIP",
      ports: [
        {
          name: "http",
          port: 80,
          targetPort: 8030,
          protocol: "TCP",
        },
      ],
      selector: { app: name },
    },
  };
}

/**
 * Generate Ingress configuration
 */
export function generateIngressConfig(
  name: string = "sentinel",
  namespace: string = "default",
  host: string,
  tlsSecretName?: string
): Record<string, unknown> {
  const ingress: Record<string, unknown> = {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name,
      namespace,
      annotations: {
        "kubernetes.io/ingress.class": "nginx",
        "nginx.ingress.kubernetes.io/proxy-body-size": "50m",
        "nginx.ingress.kubernetes.io/proxy-read-timeout": "300",
        "nginx.ingress.kubernetes.io/proxy-send-timeout": "300",
        "cert-manager.io/cluster-issuer": "letsencrypt-prod",
      },
    },
    spec: {
      rules: [
        {
          host,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name,
                    port: { number: 80 },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };

  if (tlsSecretName) {
    (ingress.spec as any).tls = [
      {
        hosts: [host],
        secretName: tlsSecretName,
      },
    ];
  }

  return ingress;
}

/**
 * Generate PodDisruptionBudget configuration
 */
export function generatePDBConfig(
  name: string = "sentinel",
  namespace: string = "default"
): Record<string, unknown> {
  return {
    apiVersion: "policy/v1",
    kind: "PodDisruptionBudget",
    metadata: {
      name,
      namespace,
    },
    spec: {
      minAvailable: 1,
      selector: {
        matchLabels: { app: name },
      },
    },
  };
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

let isShuttingDown = false;

/**
 * Handle graceful shutdown for Kubernetes
 */
export function setupGracefulShutdown(
  onShutdown: () => Promise<void>,
  timeoutMs: number = 30000
): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[K8s] Received ${signal}, starting graceful shutdown...`);

    // Set a hard timeout
    const timeout = setTimeout(() => {
      console.error("[K8s] Shutdown timeout exceeded, forcing exit");
      throw new Error("[K8s] Shutdown timeout exceeded");
    }, timeoutMs);

    try {
      // Close Redis connection
      if (redis) {
        await redis.quit();
      }

      // Run custom shutdown logic
      await onShutdown();

      console.log("[K8s] Graceful shutdown complete");
      clearTimeout(timeout);
    } catch (error) {
      console.error("[K8s] Error during shutdown:", error);
      clearTimeout(timeout);
      throw error;
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

/**
 * Check if application is shutting down
 */
export function isShuttingDownStatus(): boolean {
  return isShuttingDown;
}

// ============================================
// METRICS FOR PROMETHEUS
// ============================================

/**
 * Get Prometheus-compatible metrics
 */
export async function getPrometheusMetrics(): Promise<string> {
  const metadata = getK8sMetadata();
  const memory = process.memoryUsage();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  const health = await healthCheck();
  const healthScore =
    health.status === "healthy" ? 1 : health.status === "degraded" ? 0.5 : 0;

  const metrics = [
    `# HELP sentinel_up Whether the application is up`,
    `# TYPE sentinel_up gauge`,
    `sentinel_up{pod="${metadata.podName}",namespace="${metadata.namespace}"} 1`,
    "",
    `# HELP sentinel_health_status Health status score (1=healthy, 0.5=degraded, 0=unhealthy)`,
    `# TYPE sentinel_health_status gauge`,
    `sentinel_health_status{pod="${metadata.podName}"} ${healthScore}`,
    "",
    `# HELP sentinel_uptime_seconds Application uptime in seconds`,
    `# TYPE sentinel_uptime_seconds counter`,
    `sentinel_uptime_seconds{pod="${metadata.podName}"} ${uptime}`,
    "",
    `# HELP sentinel_memory_heap_bytes Heap memory usage in bytes`,
    `# TYPE sentinel_memory_heap_bytes gauge`,
    `sentinel_memory_heap_bytes{pod="${metadata.podName}",type="used"} ${memory.heapUsed}`,
    `sentinel_memory_heap_bytes{pod="${metadata.podName}",type="total"} ${memory.heapTotal}`,
    "",
    `# HELP sentinel_memory_rss_bytes RSS memory usage in bytes`,
    `# TYPE sentinel_memory_rss_bytes gauge`,
    `sentinel_memory_rss_bytes{pod="${metadata.podName}"} ${memory.rss}`,
    "",
    `# HELP sentinel_info Application information`,
    `# TYPE sentinel_info gauge`,
    `sentinel_info{version="${process.env.APP_VERSION || "1.0.0"}",node_env="${env.NODE_ENV}"} 1`,
  ];

  // Add component health metrics
  for (const [component, check] of Object.entries(health.checks)) {
    const score = check.status === "healthy" ? 1 : check.status === "degraded" ? 0.5 : 0;
    metrics.push(
      `# HELP sentinel_component_health_${component} Health status of ${component}`,
      `# TYPE sentinel_component_health_${component} gauge`,
      `sentinel_component_health_${component}{pod="${metadata.podName}"} ${score}`
    );

    if (check.latencyMs !== undefined) {
      metrics.push(
        `# HELP sentinel_component_latency_${component}_ms Latency of ${component} in milliseconds`,
        `# TYPE sentinel_component_latency_${component}_ms gauge`,
        `sentinel_component_latency_${component}_ms{pod="${metadata.podName}"} ${check.latencyMs}`
      );
    }
  }

  return metrics.join("\n");
}

export default {
  healthCheck,
  livenessCheck,
  readinessCheck,
  startupCheck,
  getK8sMetadata,
  isRunningInK8s,
  generateDeploymentConfig,
  generateHPAConfig,
  generateServiceConfig,
  generateIngressConfig,
  generatePDBConfig,
  setupGracefulShutdown,
  isShuttingDownStatus,
  getPrometheusMetrics,
};
