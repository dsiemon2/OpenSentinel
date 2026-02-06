/**
 * Enterprise Features Module
 *
 * This module provides enterprise-grade capabilities for OpenSentinel including:
 * - Multi-user management with roles and permissions
 * - Team knowledge base with shared memories
 * - Usage quotas and billing integration
 * - SSO/SAML/OAuth enterprise authentication
 * - Kubernetes deployment helpers and health checks
 */

// Multi-user management
export {
  // Types
  type UserRole,
  type UserStatus,
  type EnterpriseUser,
  type UserMetadata,
  type CreateUserOptions,
  type UpdateUserOptions,
  type UserSearchOptions,
  type BulkImportResult,
  type UserInvitation,

  // User CRUD
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  deleteUser,
  suspendUser,
  reactivateUser,

  // User search & listing
  searchUsers,
  getOrganizationUsers,
  getDirectReports,

  // Bulk operations
  bulkImportUsers,
  bulkUpdateUsers,
  bulkDeactivateUsers,

  // Invitations
  createInvitation,
  acceptInvitation,
  revokeInvitation,
  getPendingInvitations,

  // Analytics
  getUserActivitySummary,
  getOrganizationUserStats,

  // Default export
  default as MultiUserManager,
} from "./multi-user";

// Team memory / Knowledge base
export {
  // Types
  type MemoryVisibility,
  type MemoryCategory,
  type TeamMemory,
  type TeamMemoryMetadata,
  type CreateTeamMemoryOptions,
  type TeamMemorySearchOptions,
  type KnowledgeBaseStats,

  // Team memory CRUD
  createTeamMemory,
  getTeamMemory,
  updateTeamMemory,
  deleteTeamMemory,

  // Search & discovery
  searchTeamMemories,
  getRelatedMemories,
  getTrendingMemories,

  // Knowledge base management
  getKnowledgeBaseStats,
  exportKnowledgeBase,
  importKnowledgeBase,

  // AI-powered features
  autoCategorizeMemory,
  generateMemorySummary,
  findDuplicates,

  // Default export
  default as TeamMemoryManager,
} from "./team-memory";

// Usage quotas
export {
  // Types
  type QuotaType,
  type QuotaTier,
  type QuotaLimit,
  type QuotaConfig,
  type QuotaCheckResult,
  type QuotaUsageReport,

  // Constants
  TIER_LIMITS,

  // Quota management
  initializeUserQuota,
  getUserQuotaConfig,
  checkQuota,
  incrementQuota,
  decrementQuota,
  setQuotaLimit,
  resetQuotas,

  // Usage reporting
  getUsageReport,
  getOrganizationUsageReport,
  getUsageTrends,

  // Alerts
  checkQuotaWarnings,
  subscribeToQuotaAlerts,

  // Cleanup
  closeQuotaManager,

  // Default export
  default as QuotaManager,
} from "./usage-quotas";

// SSO integration
export {
  // Types
  type SSOProvider,
  type SSOConfig,
  type SSOProviderConfig,
  type AttributeMapping,
  type SSOSession,
  type SSOLoginResult,
  type SAMLAssertion,
  type OAuthTokens,

  // SSO configuration
  createSSOConfig,
  getSSOConfig,
  updateSSOConfig,
  toggleSSO,
  deleteSSOConfig,

  // SAML
  generateSAMLAuthRequest,
  processSAMLResponse,
  generateSAMLLogoutRequest,

  // OAuth2/OIDC
  generateOAuthAuthUrl,
  exchangeOAuthCode,
  getOAuthUserInfo,
  processOAuthCallback,
  refreshOAuthTokens,

  // Provider helpers
  getProviderDefaults,
  configureAzureAD,
  configureOkta,
  configureGoogleWorkspace,

  // LDAP
  authenticateLDAP,

  // Default export
  default as SSOManager,
} from "./sso-integration";

// Kubernetes deployment
export {
  // Types
  type HealthStatus,
  type HealthCheckResult,
  type ComponentHealth,
  type ReadinessCheckResult,
  type LivenessCheckResult,
  type K8sMetadata,
  type K8sConfig,
  type ProbeConfig,

  // Health checks
  healthCheck,
  livenessCheck,
  readinessCheck,
  startupCheck,

  // K8s metadata
  getK8sMetadata,
  isRunningInK8s,

  // Manifest generators
  generateDeploymentConfig,
  generateHPAConfig,
  generateServiceConfig,
  generateIngressConfig,
  generatePDBConfig,

  // Lifecycle management
  setupGracefulShutdown,
  isShuttingDownStatus,

  // Metrics
  getPrometheusMetrics,

  // Default export
  default as KubernetesManager,
} from "./kubernetes";

// ============================================
// ENTERPRISE MODULE INITIALIZATION
// ============================================

import { setupGracefulShutdown } from "./kubernetes";
import { closeQuotaManager } from "./usage-quotas";

/**
 * Initialize enterprise features
 * Call this during application startup
 */
export async function initializeEnterprise(): Promise<void> {
  console.log("[Enterprise] Initializing enterprise features...");

  // Setup graceful shutdown handling
  setupGracefulShutdown(async () => {
    console.log("[Enterprise] Running shutdown cleanup...");
    await closeQuotaManager();
    console.log("[Enterprise] Shutdown cleanup complete");
  });

  console.log("[Enterprise] Enterprise features initialized");
}

/**
 * Enterprise feature flags
 */
export interface EnterpriseFeatureFlags {
  multiUser: boolean;
  teamMemory: boolean;
  usageQuotas: boolean;
  sso: boolean;
  kubernetes: boolean;
}

/**
 * Get current enterprise feature status
 */
export function getEnterpriseFeatures(): EnterpriseFeatureFlags {
  return {
    multiUser: true,
    teamMemory: true,
    usageQuotas: true,
    sso: true,
    kubernetes: true,
  };
}

/**
 * Check if enterprise features are enabled
 */
export function isEnterpriseEnabled(): boolean {
  return process.env.ENTERPRISE_ENABLED !== "false";
}
