/**
 * SSO Integration System
 * Comprehensive enterprise authentication with SAML, OAuth, and LDAP support
 */

export enum SSOProvider {
  SAML = "saml",
  OAUTH_GOOGLE = "oauth_google",
  OAUTH_MICROSOFT = "oauth_microsoft",
  OAUTH_GITHUB = "oauth_github",
  OAUTH_SLACK = "oauth_slack",
  LDAP = "ldap",
  ACTIVE_DIRECTORY = "active_directory",
  OKTA = "okta",
  AUTH0 = "auth0",
  ONELOGIN = "onelogin",
}

export interface SSOConfiguration {
  id: string;
  provider: SSOProvider;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  settings: SSOSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSOSettings {
  // Common settings
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];

  // SAML specific
  samlSettings?: {
    entryPoint: string;
    certificate: string;
    issuer: string;
    signatureAlgorithm: string;
    digestAlgorithm: string;
    authnRequestBinding: string;
    attributeMapping: {
      email: string;
      firstName: string;
      lastName: string;
      displayName: string;
      groups: string;
    };
  };

  // LDAP specific
  ldapSettings?: {
    url: string;
    bindDN: string;
    bindCredentials: string;
    searchBase: string;
    searchFilter: string;
    searchAttributes: string[];
    tlsOptions?: {
      rejectUnauthorized: boolean;
      ca?: string;
    };
  };

  // OAuth specific
  oauthSettings?: {
    authorizationURL: string;
    tokenURL: string;
    userInfoURL: string;
    scope: string;
    profileFields: string[];
  };
}

export interface SSOUser {
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  groups: string[];
  attributes: Record<string, any>;
  provider: SSOProvider;
  lastLogin: Date;
}

export interface AuthenticationResult {
  success: boolean;
  user?: SSOUser;
  token?: string;
  error?: string;
  requiresAdditionalAuth?: boolean;
  mfaChallenge?: {
    type: "totp" | "sms" | "email";
    challenge: string;
  };
}

class SSOIntegrationService {
  private configurations: Map<string, SSOConfiguration> = new Map();
  private activeProviders: Map<SSOProvider, SSOConfiguration> = new Map();

  constructor() {
    this.loadConfigurations();
  }

  /**
   * Configure SSO provider
   */
  async configureSSOProvider(
    config: Omit<SSOConfiguration, "id" | "createdAt" | "updatedAt">
  ): Promise<SSOConfiguration> {
    try {
      const response = await fetch("/api/admin/sso/configure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Failed to configure SSO provider");
      }

      const savedConfig = await response.json();
      this.configurations.set(savedConfig.id, savedConfig);

      if (savedConfig.enabled) {
        this.activeProviders.set(savedConfig.provider, savedConfig);
      }

      return savedConfig;
    } catch (error) {
      console.error("Failed to configure SSO provider:", error);
      throw error;
    }
  }

  /**
   * Get available SSO providers
   */
  getAvailableProviders(): SSOConfiguration[] {
    return Array.from(this.activeProviders.values()).filter(
      (config) => config.enabled
    );
  }

  /**
   * Initiate SSO authentication
   */
  async initiateSSOAuth(
    provider: SSOProvider,
    returnUrl?: string
  ): Promise<string> {
    try {
      const config = this.activeProviders.get(provider);
      if (!config) {
        throw new Error(
          `SSO provider ${provider} is not configured or enabled`
        );
      }

      const response = await fetch("/api/auth/sso/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          returnUrl: returnUrl || window.location.origin,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate SSO authentication");
      }

      const { authUrl } = await response.json();
      return authUrl;
    } catch (error) {
      console.error("Failed to initiate SSO auth:", error);
      throw error;
    }
  }

  /**
   * Handle SSO callback
   */
  async handleSSOCallback(
    provider: SSOProvider,
    callbackData: any
  ): Promise<AuthenticationResult> {
    try {
      const response = await fetch("/api/auth/sso/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          callbackData,
        }),
      });

      if (!response.ok) {
        throw new Error("SSO authentication failed");
      }

      return await response.json();
    } catch (error) {
      console.error("SSO callback error:", error);
      throw error;
    }
  }

  /**
   * Test SSO configuration
   */
  async testSSOConfiguration(
    configId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/admin/sso/test/${configId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error("Failed to test SSO configuration:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get SSO configuration
   */
  getSSOConfiguration(configId: string): SSOConfiguration | undefined {
    return this.configurations.get(configId);
  }

  /**
   * Update SSO configuration
   */
  async updateSSOConfiguration(
    configId: string,
    updates: Partial<SSOSettings>
  ): Promise<SSOConfiguration> {
    try {
      const response = await fetch(`/api/admin/sso/${configId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update SSO configuration");
      }

      const updatedConfig = await response.json();
      this.configurations.set(configId, updatedConfig);

      if (updatedConfig.enabled) {
        this.activeProviders.set(updatedConfig.provider, updatedConfig);
      } else {
        this.activeProviders.delete(updatedConfig.provider);
      }

      return updatedConfig;
    } catch (error) {
      console.error("Failed to update SSO configuration:", error);
      throw error;
    }
  }

  /**
   * Delete SSO configuration
   */
  async deleteSSOConfiguration(configId: string): Promise<void> {
    try {
      const config = this.configurations.get(configId);
      if (!config) {
        throw new Error("SSO configuration not found");
      }

      const response = await fetch(`/api/admin/sso/${configId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete SSO configuration");
      }

      this.configurations.delete(configId);
      this.activeProviders.delete(config.provider);
    } catch (error) {
      console.error("Failed to delete SSO configuration:", error);
      throw error;
    }
  }

  /**
   * Get SSO user mappings
   */
  async getSSOUserMappings(): Promise<
    Array<{ externalId: string; internalUserId: number; provider: SSOProvider }>
  > {
    try {
      const response = await fetch("/api/admin/sso/user-mappings", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get SSO user mappings");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get SSO user mappings:", error);
      throw error;
    }
  }

  /**
   * Enable/disable SSO provider
   */
  async toggleSSOProvider(configId: string, enabled: boolean): Promise<void> {
    try {
      const response = await fetch(`/api/admin/sso/${configId}/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle SSO provider");
      }

      const config = this.configurations.get(configId);
      if (config) {
        config.enabled = enabled;
        if (enabled) {
          this.activeProviders.set(config.provider, config);
        } else {
          this.activeProviders.delete(config.provider);
        }
      }
    } catch (error) {
      console.error("Failed to toggle SSO provider:", error);
      throw error;
    }
  }

  /**
   * Get SSO analytics
   */
  async getSSOAnalytics(): Promise<{
    totalLogins: number;
    loginsByProvider: Record<SSOProvider, number>;
    failedLogins: number;
    averageLoginTime: number;
    activeUsers: number;
  }> {
    try {
      const response = await fetch("/api/admin/sso/analytics", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get SSO analytics");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get SSO analytics:", error);
      throw error;
    }
  }

  /**
   * Provision user from SSO
   */
  async provisionSSOUser(
    ssoUser: SSOUser
  ): Promise<{ userId: number; isNewUser: boolean }> {
    try {
      const response = await fetch("/api/auth/sso/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(ssoUser),
      });

      if (!response.ok) {
        throw new Error("Failed to provision SSO user");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to provision SSO user:", error);
      throw error;
    }
  }

  /**
   * Load configurations from server
   */
  private async loadConfigurations(): Promise<void> {
    try {
      const response = await fetch("/api/admin/sso/configurations", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const configs = await response.json();
        this.configurations.clear();
        this.activeProviders.clear();

        configs.forEach((config: SSOConfiguration) => {
          this.configurations.set(config.id, config);
          if (config.enabled) {
            this.activeProviders.set(config.provider, config);
          }
        });
      }
    } catch (error) {
      console.error("Failed to load SSO configurations:", error);
    }
  }

  /**
   * Validate SAML response
   */
  async validateSAMLResponse(
    samlResponse: string,
    relayState?: string
  ): Promise<AuthenticationResult> {
    try {
      const response = await fetch("/api/auth/saml/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          samlResponse,
          relayState,
        }),
      });

      if (!response.ok) {
        throw new Error("SAML validation failed");
      }

      return await response.json();
    } catch (error) {
      console.error("SAML validation error:", error);
      throw error;
    }
  }

  /**
   * Get SAML metadata
   */
  async getSAMLMetadata(configId: string): Promise<string> {
    try {
      const response = await fetch(`/api/auth/saml/metadata/${configId}`);

      if (!response.ok) {
        throw new Error("Failed to get SAML metadata");
      }

      return await response.text();
    } catch (error) {
      console.error("Failed to get SAML metadata:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const ssoIntegrationService = new SSOIntegrationService();
export default ssoIntegrationService;
