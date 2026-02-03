import { db } from "../../db";
import { users, sessions, organizations, organizationMembers } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

// Simple JWT decode function (for OIDC id_token parsing)
function decodeJwt(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

// ============================================
// TYPES
// ============================================

export type SSOProvider = "saml" | "oauth2" | "oidc" | "ldap" | "azure_ad" | "okta" | "google_workspace";

export interface SSOConfig {
  id: string;
  organizationId: string;
  provider: SSOProvider;
  enabled: boolean;
  config: SSOProviderConfig;
  attributeMapping: AttributeMapping;
  defaultRole: string;
  autoProvision: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSOProviderConfig {
  // SAML
  entityId?: string;
  ssoUrl?: string;
  sloUrl?: string;
  certificate?: string;
  signatureAlgorithm?: string;
  digestAlgorithm?: string;

  // OAuth2/OIDC
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes?: string[];
  issuer?: string;
  jwksUri?: string;

  // LDAP
  ldapUrl?: string;
  baseDn?: string;
  bindDn?: string;
  bindPassword?: string;
  userFilter?: string;
  groupFilter?: string;

  // Azure AD specific
  tenantId?: string;

  // General
  callbackUrl?: string;
  allowedDomains?: string[];
}

export interface AttributeMapping {
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  groups?: string;
  roles?: string;
  employeeId?: string;
  manager?: string;
  phoneNumber?: string;
}

export interface SSOSession {
  id: string;
  userId: string;
  provider: SSOProvider;
  externalId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SSOLoginResult {
  success: boolean;
  userId?: string;
  sessionToken?: string;
  error?: string;
  isNewUser?: boolean;
  needsApproval?: boolean;
}

export interface SAMLAssertion {
  nameId: string;
  sessionIndex?: string;
  attributes: Record<string, string | string[]>;
  conditions?: {
    notBefore?: Date;
    notOnOrAfter?: Date;
  };
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
}

// ============================================
// SSO CONFIGURATION MANAGEMENT
// ============================================

/**
 * Create SSO configuration for organization
 */
export async function createSSOConfig(
  organizationId: string,
  provider: SSOProvider,
  config: SSOProviderConfig,
  attributeMapping?: Partial<AttributeMapping>
): Promise<SSOConfig> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  const settings = (org.settings as any) || {};
  const ssoConfigs = settings.ssoConfigs || [];

  const defaultMapping: AttributeMapping = {
    email: "email",
    firstName: "given_name",
    lastName: "family_name",
    displayName: "name",
    department: "department",
    groups: "groups",
    roles: "roles",
    ...attributeMapping,
  };

  const ssoConfig: SSOConfig = {
    id: randomBytes(16).toString("hex"),
    organizationId,
    provider,
    enabled: false,
    config,
    attributeMapping: defaultMapping,
    defaultRole: "member",
    autoProvision: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Remove any existing config for this provider
  const filteredConfigs = ssoConfigs.filter((c: SSOConfig) => c.provider !== provider);
  filteredConfigs.push(ssoConfig);

  await db
    .update(organizations)
    .set({ settings: { ...settings, ssoConfigs: filteredConfigs } })
    .where(eq(organizations.id, organizationId));

  return ssoConfig;
}

/**
 * Get SSO configuration for organization
 */
export async function getSSOConfig(
  organizationId: string,
  provider?: SSOProvider
): Promise<SSOConfig | SSOConfig[] | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) return null;

  const settings = (org.settings as any) || {};
  const ssoConfigs: SSOConfig[] = settings.ssoConfigs || [];

  if (provider) {
    return ssoConfigs.find((c) => c.provider === provider) || null;
  }

  return ssoConfigs;
}

/**
 * Update SSO configuration
 */
export async function updateSSOConfig(
  organizationId: string,
  provider: SSOProvider,
  updates: Partial<SSOConfig>
): Promise<SSOConfig> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  const settings = (org.settings as any) || {};
  const ssoConfigs: SSOConfig[] = settings.ssoConfigs || [];

  const index = ssoConfigs.findIndex((c) => c.provider === provider);
  if (index === -1) {
    throw new Error(`SSO configuration for ${provider} not found`);
  }

  ssoConfigs[index] = {
    ...ssoConfigs[index],
    ...updates,
    updatedAt: new Date(),
  };

  await db
    .update(organizations)
    .set({ settings: { ...settings, ssoConfigs } })
    .where(eq(organizations.id, organizationId));

  return ssoConfigs[index];
}

/**
 * Enable/disable SSO
 */
export async function toggleSSO(
  organizationId: string,
  provider: SSOProvider,
  enabled: boolean
): Promise<void> {
  await updateSSOConfig(organizationId, provider, { enabled });
}

/**
 * Delete SSO configuration
 */
export async function deleteSSOConfig(
  organizationId: string,
  provider: SSOProvider
): Promise<void> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  const settings = (org.settings as any) || {};
  const ssoConfigs: SSOConfig[] = settings.ssoConfigs || [];

  const filteredConfigs = ssoConfigs.filter((c) => c.provider !== provider);

  await db
    .update(organizations)
    .set({ settings: { ...settings, ssoConfigs: filteredConfigs } })
    .where(eq(organizations.id, organizationId));
}

// ============================================
// SAML IMPLEMENTATION
// ============================================

/**
 * Generate SAML authentication request
 */
export function generateSAMLAuthRequest(
  ssoConfig: SSOConfig,
  relayState?: string
): { url: string; requestId: string } {
  const config = ssoConfig.config;

  if (!config.ssoUrl || !config.entityId) {
    throw new Error("SAML configuration incomplete");
  }

  const requestId = `_${randomBytes(16).toString("hex")}`;
  const issueInstant = new Date().toISOString();

  // Simplified SAML AuthnRequest (production would use proper XML signing)
  const authnRequest = `
    <samlp:AuthnRequest
      xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${requestId}"
      Version="2.0"
      IssueInstant="${issueInstant}"
      AssertionConsumerServiceURL="${config.callbackUrl}"
      ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
      <saml:Issuer>${config.entityId}</saml:Issuer>
      <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"/>
    </samlp:AuthnRequest>
  `.trim();

  // Base64 encode and URL encode
  const encodedRequest = Buffer.from(authnRequest).toString("base64");
  const urlEncodedRequest = encodeURIComponent(encodedRequest);

  let url = `${config.ssoUrl}?SAMLRequest=${urlEncodedRequest}`;
  if (relayState) {
    url += `&RelayState=${encodeURIComponent(relayState)}`;
  }

  return { url, requestId };
}

/**
 * Process SAML response
 */
export async function processSAMLResponse(
  samlResponse: string,
  organizationId: string
): Promise<SSOLoginResult> {
  try {
    const config = (await getSSOConfig(organizationId, "saml")) as SSOConfig;
    if (!config || !config.enabled) {
      return { success: false, error: "SAML not configured or disabled" };
    }

    // Decode SAML response (simplified - production would validate signature)
    const decoded = Buffer.from(samlResponse, "base64").toString("utf-8");

    // Extract assertion (simplified parsing)
    const assertion = parseSAMLAssertion(decoded, config.attributeMapping);

    if (!assertion.nameId) {
      return { success: false, error: "No nameId in SAML assertion" };
    }

    // Find or create user
    const result = await findOrCreateSSOUser(
      organizationId,
      "saml",
      assertion.nameId,
      mapSAMLAttributesToUser(assertion.attributes, config.attributeMapping),
      config
    );

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "SAML processing failed",
    };
  }
}

/**
 * Generate SAML logout request
 */
export function generateSAMLLogoutRequest(
  ssoConfig: SSOConfig,
  nameId: string,
  sessionIndex?: string
): string {
  const config = ssoConfig.config;

  if (!config.sloUrl) {
    throw new Error("SAML SLO URL not configured");
  }

  const requestId = `_${randomBytes(16).toString("hex")}`;
  const issueInstant = new Date().toISOString();

  const logoutRequest = `
    <samlp:LogoutRequest
      xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${requestId}"
      Version="2.0"
      IssueInstant="${issueInstant}"
      Destination="${config.sloUrl}">
      <saml:Issuer>${config.entityId}</saml:Issuer>
      <saml:NameID>${nameId}</saml:NameID>
      ${sessionIndex ? `<samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>` : ""}
    </samlp:LogoutRequest>
  `.trim();

  const encodedRequest = Buffer.from(logoutRequest).toString("base64");
  return `${config.sloUrl}?SAMLRequest=${encodeURIComponent(encodedRequest)}`;
}

// ============================================
// OAUTH2/OIDC IMPLEMENTATION
// ============================================

/**
 * Generate OAuth2 authorization URL
 */
export function generateOAuthAuthUrl(
  ssoConfig: SSOConfig,
  state: string,
  nonce?: string
): string {
  const config = ssoConfig.config;

  if (!config.clientId || !config.authorizationUrl) {
    throw new Error("OAuth configuration incomplete");
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl || "",
    response_type: "code",
    scope: (config.scopes || ["openid", "email", "profile"]).join(" "),
    state,
  });

  if (nonce) {
    params.set("nonce", nonce);
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange OAuth2 code for tokens
 */
export async function exchangeOAuthCode(
  ssoConfig: SSOConfig,
  code: string
): Promise<OAuthTokens> {
  const config = ssoConfig.config;

  if (!config.clientId || !config.clientSecret || !config.tokenUrl) {
    throw new Error("OAuth configuration incomplete");
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.callbackUrl || "",
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
}

/**
 * Get user info from OAuth provider
 */
export async function getOAuthUserInfo(
  ssoConfig: SSOConfig,
  accessToken: string
): Promise<Record<string, unknown>> {
  const config = ssoConfig.config;

  if (!config.userInfoUrl) {
    // Try to decode ID token for OIDC
    throw new Error("UserInfo URL not configured");
  }

  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user info");
  }

  return response.json();
}

/**
 * Process OAuth callback
 */
export async function processOAuthCallback(
  code: string,
  state: string,
  organizationId: string
): Promise<SSOLoginResult> {
  try {
    const config = (await getSSOConfig(organizationId, "oauth2")) as SSOConfig;
    if (!config || !config.enabled) {
      return { success: false, error: "OAuth not configured or disabled" };
    }

    // Exchange code for tokens
    const tokens = await exchangeOAuthCode(config, code);

    // Get user info
    let userInfo: Record<string, unknown>;

    if (tokens.idToken && config.provider === "oidc") {
      // Decode ID token for OIDC
      const claims = decodeJwt(tokens.idToken);
      userInfo = claims as Record<string, unknown>;
    } else {
      userInfo = await getOAuthUserInfo(config, tokens.accessToken);
    }

    // Map user info to our format
    const email = mapAttribute(userInfo, config.attributeMapping.email);
    if (!email) {
      return { success: false, error: "No email in OAuth response" };
    }

    const userData = {
      email,
      name: mapAttribute(userInfo, config.attributeMapping.displayName || "name") ||
        `${mapAttribute(userInfo, config.attributeMapping.firstName || "given_name") || ""} ${mapAttribute(userInfo, config.attributeMapping.lastName || "family_name") || ""}`.trim(),
      department: mapAttribute(userInfo, config.attributeMapping.department || "department"),
      groups: mapAttribute(userInfo, config.attributeMapping.groups || "groups"),
    };

    const result = await findOrCreateSSOUser(
      organizationId,
      config.provider,
      email,
      userData,
      config
    );

    // Store tokens in session
    if (result.success && result.userId) {
      await storeSSOTokens(result.userId, config.provider, tokens);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "OAuth processing failed",
    };
  }
}

/**
 * Refresh OAuth tokens
 */
export async function refreshOAuthTokens(
  userId: string,
  organizationId: string
): Promise<OAuthTokens | null> {
  const config = (await getSSOConfig(organizationId, "oauth2")) as SSOConfig;
  if (!config || !config.config.tokenUrl) {
    return null;
  }

  // Get stored refresh token
  const storedTokens = await getSSOTokens(userId, config.provider);
  if (!storedTokens?.refreshToken) {
    return null;
  }

  const response = await fetch(config.config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: storedTokens.refreshToken,
      client_id: config.config.clientId || "",
      client_secret: config.config.clientSecret || "",
    }).toString(),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const tokens: OAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || storedTokens.refreshToken,
    idToken: data.id_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  };

  await storeSSOTokens(userId, config.provider, tokens);

  return tokens;
}

// ============================================
// AZURE AD / OKTA / GOOGLE WORKSPACE
// ============================================

/**
 * Get provider-specific configuration
 */
export function getProviderDefaults(provider: SSOProvider): Partial<SSOProviderConfig> {
  switch (provider) {
    case "azure_ad":
      return {
        authorizationUrl: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
        userInfoUrl: "https://graph.microsoft.com/v1.0/me",
        scopes: ["openid", "email", "profile", "User.Read"],
      };
    case "okta":
      return {
        scopes: ["openid", "email", "profile", "groups"],
      };
    case "google_workspace":
      return {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
        scopes: ["openid", "email", "profile"],
      };
    default:
      return {};
  }
}

/**
 * Configure Azure AD SSO
 */
export async function configureAzureAD(
  organizationId: string,
  tenantId: string,
  clientId: string,
  clientSecret: string,
  callbackUrl: string
): Promise<SSOConfig> {
  const defaults = getProviderDefaults("azure_ad");

  return createSSOConfig(organizationId, "azure_ad", {
    tenantId,
    clientId,
    clientSecret,
    callbackUrl,
    authorizationUrl: defaults.authorizationUrl?.replace("{tenantId}", tenantId),
    tokenUrl: defaults.tokenUrl?.replace("{tenantId}", tenantId),
    userInfoUrl: defaults.userInfoUrl,
    scopes: defaults.scopes,
  });
}

/**
 * Configure Okta SSO
 */
export async function configureOkta(
  organizationId: string,
  domain: string,
  clientId: string,
  clientSecret: string,
  callbackUrl: string
): Promise<SSOConfig> {
  const defaults = getProviderDefaults("okta");

  return createSSOConfig(organizationId, "okta", {
    issuer: `https://${domain}`,
    clientId,
    clientSecret,
    callbackUrl,
    authorizationUrl: `https://${domain}/oauth2/v1/authorize`,
    tokenUrl: `https://${domain}/oauth2/v1/token`,
    userInfoUrl: `https://${domain}/oauth2/v1/userinfo`,
    scopes: defaults.scopes,
  });
}

/**
 * Configure Google Workspace SSO
 */
export async function configureGoogleWorkspace(
  organizationId: string,
  clientId: string,
  clientSecret: string,
  callbackUrl: string,
  allowedDomains: string[]
): Promise<SSOConfig> {
  const defaults = getProviderDefaults("google_workspace");

  return createSSOConfig(
    organizationId,
    "google_workspace",
    {
      clientId,
      clientSecret,
      callbackUrl,
      authorizationUrl: defaults.authorizationUrl,
      tokenUrl: defaults.tokenUrl,
      userInfoUrl: defaults.userInfoUrl,
      scopes: defaults.scopes,
      allowedDomains,
    },
    {
      email: "email",
      firstName: "given_name",
      lastName: "family_name",
      displayName: "name",
    }
  );
}

// ============================================
// LDAP IMPLEMENTATION
// ============================================

/**
 * Authenticate via LDAP
 */
export async function authenticateLDAP(
  organizationId: string,
  username: string,
  password: string
): Promise<SSOLoginResult> {
  const config = (await getSSOConfig(organizationId, "ldap")) as SSOConfig;
  if (!config || !config.enabled) {
    return { success: false, error: "LDAP not configured or disabled" };
  }

  const ldapConfig = config.config;

  // Note: In production, use a proper LDAP library like ldapjs
  // This is a simplified implementation
  try {
    // Construct user DN
    const userDn = `uid=${username},${ldapConfig.baseDn}`;

    // Bind attempt (simulated - would use actual LDAP connection)
    // const client = ldap.createClient({ url: ldapConfig.ldapUrl });
    // await client.bind(userDn, password);

    // Get user attributes
    const userData = {
      email: `${username}@${ldapConfig.baseDn?.split(",").map(p => p.split("=")[1]).join(".")}`,
      name: username,
    };

    return findOrCreateSSOUser(organizationId, "ldap", username, userData, config);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "LDAP authentication failed",
    };
  }
}

// ============================================
// HELPERS
// ============================================

async function findOrCreateSSOUser(
  organizationId: string,
  provider: SSOProvider,
  externalId: string,
  userData: { email: string; name?: string; department?: string; groups?: string },
  ssoConfig: SSOConfig
): Promise<SSOLoginResult> {
  // Check if user exists
  const existingResult = await db.execute(
    sql`SELECT * FROM users WHERE preferences->>'ssoExternalId' = ${externalId} AND preferences->>'ssoProvider' = ${provider} LIMIT 1`
  ) as unknown as { rows: any[] };

  let userId: string;
  let isNewUser = false;

  if (existingResult.rows.length > 0) {
    userId = (existingResult.rows[0] as any).id;

    // Update user info
    await db.execute(
      sql`UPDATE users SET name = ${userData.name || ""}, updated_at = NOW() WHERE id = ${userId}::uuid`
    );
  } else {
    // Check if user with email exists
    const emailResult = await db.execute(
      sql`SELECT * FROM users WHERE preferences->>'email' = ${userData.email} LIMIT 1`
    ) as unknown as { rows: any[] };

    if (emailResult.rows.length > 0) {
      // Link existing user to SSO
      userId = (emailResult.rows[0] as any).id;
      await db.execute(
        sql`UPDATE users SET preferences = preferences || ${JSON.stringify({
          ssoExternalId: externalId,
          ssoProvider: provider,
        })}::jsonb WHERE id = ${userId}::uuid`
      );
    } else {
      // Auto-provision if enabled
      if (!ssoConfig.autoProvision) {
        return { success: false, needsApproval: true, error: "User requires approval" };
      }

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          name: userData.name || userData.email.split("@")[0],
          preferences: {
            email: userData.email,
            ssoExternalId: externalId,
            ssoProvider: provider,
            department: userData.department,
          } as any,
        })
        .returning();

      userId = newUser.id;
      isNewUser = true;

      // Add to organization
      await db.insert(organizationMembers).values({
        organizationId,
        userId,
        role: ssoConfig.defaultRole as any,
      });
    }
  }

  // Create session
  const sessionToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");

  await db.insert(sessions).values({
    userId,
    token: tokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  return {
    success: true,
    userId,
    sessionToken,
    isNewUser,
  };
}

function parseSAMLAssertion(xml: string, mapping: AttributeMapping): SAMLAssertion {
  // Simplified SAML parsing (production would use proper XML parser)
  const nameIdMatch = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
  const nameId = nameIdMatch ? nameIdMatch[1] : "";

  const sessionIndexMatch = xml.match(/SessionIndex="([^"]+)"/);
  const sessionIndex = sessionIndexMatch ? sessionIndexMatch[1] : undefined;

  // Extract attributes (simplified)
  const attributes: Record<string, string> = {};
  const attrMatches = xml.matchAll(/<saml:Attribute Name="([^"]+)"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g);

  for (const match of attrMatches) {
    attributes[match[1]] = match[2];
  }

  return { nameId, sessionIndex, attributes };
}

function mapSAMLAttributesToUser(
  attributes: Record<string, string | string[]>,
  mapping: AttributeMapping
): { email: string; name?: string; department?: string } {
  const getValue = (key: string): string | undefined => {
    const value = attributes[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    email: getValue(mapping.email) || "",
    name: getValue(mapping.displayName || "name") ||
      `${getValue(mapping.firstName || "given_name") || ""} ${getValue(mapping.lastName || "family_name") || ""}`.trim() ||
      undefined,
    department: getValue(mapping.department || "department"),
  };
}

function mapAttribute(obj: Record<string, unknown>, path: string): string | undefined {
  const value = path.split(".").reduce((o: any, k) => o?.[k], obj);
  return typeof value === "string" ? value : undefined;
}

async function storeSSOTokens(
  userId: string,
  provider: SSOProvider,
  tokens: OAuthTokens
): Promise<void> {
  await db.execute(
    sql`UPDATE users SET preferences = preferences || ${JSON.stringify({
      ssoTokens: {
        provider,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      },
    })}::jsonb WHERE id = ${userId}::uuid`
  );
}

async function getSSOTokens(
  userId: string,
  provider: SSOProvider
): Promise<{ accessToken?: string; refreshToken?: string; expiresAt?: Date } | null> {
  const result = await db.execute(
    sql`SELECT preferences->'ssoTokens' as tokens FROM users WHERE id = ${userId}::uuid`
  ) as unknown as { rows: any[] };

  if (result.rows.length === 0) return null;

  const tokens = (result.rows[0] as any).tokens;
  if (!tokens || tokens.provider !== provider) return null;

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : undefined,
  };
}

export default {
  createSSOConfig,
  getSSOConfig,
  updateSSOConfig,
  toggleSSO,
  deleteSSOConfig,
  generateSAMLAuthRequest,
  processSAMLResponse,
  generateSAMLLogoutRequest,
  generateOAuthAuthUrl,
  exchangeOAuthCode,
  getOAuthUserInfo,
  processOAuthCallback,
  refreshOAuthTokens,
  getProviderDefaults,
  configureAzureAD,
  configureOkta,
  configureGoogleWorkspace,
  authenticateLDAP,
};
