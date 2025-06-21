/**
 * SSO Configuration Component
 * UI for managing Single Sign-On providers
 */

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ssoIntegrationService,
  SSOProvider,
  SSOConfiguration,
} from "@/lib/sso-integration";
import {
  Shield,
  Plus,
  Settings,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

export default function SSOConfiguration() {
  const { toast } = useToast();
  const [configurations, setConfigurations] = useState<SSOConfiguration[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SSOConfiguration | null>(
    null
  );
  const [testResults, setTestResults] = useState<
    Map<string, { success: boolean; error?: string }>
  >(new Map());

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      const configs = await ssoIntegrationService.getAvailableProviders();
      setConfigurations(configs);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load SSO configurations",
        variant: "destructive",
      });
    }
  };

  const handleAddConfiguration = async (
    provider: SSOProvider,
    settings: any
  ) => {
    try {
      await ssoIntegrationService.configureSSOProvider({
        provider,
        name: `${provider} SSO`,
        enabled: true,
        isDefault: false,
        settings,
      });

      await loadConfigurations();
      setShowAddDialog(false);

      toast({
        title: "Success",
        description: "SSO provider configured successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to configure SSO provider",
        variant: "destructive",
      });
    }
  };

  const handleTestConfiguration = async (configId: string) => {
    try {
      const result = await ssoIntegrationService.testSSOConfiguration(configId);
      setTestResults((prev) => new Map(prev.set(configId, result)));

      toast({
        title: result.success ? "Test Successful" : "Test Failed",
        description: result.success
          ? "SSO configuration is working correctly"
          : result.error,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test SSO configuration",
        variant: "destructive",
      });
    }
  };

  const handleToggleProvider = async (configId: string, enabled: boolean) => {
    try {
      await ssoIntegrationService.toggleSSOProvider(configId, enabled);
      await loadConfigurations();

      toast({
        title: "Success",
        description: `SSO provider ${
          enabled ? "enabled" : "disabled"
        } successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle SSO provider",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfiguration = async (configId: string) => {
    try {
      await ssoIntegrationService.deleteSSOConfiguration(configId);
      await loadConfigurations();

      toast({
        title: "Success",
        description: "SSO configuration deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete SSO configuration",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SSO Configuration</h2>
          <p className="text-muted-foreground">
            Configure Single Sign-On providers for enterprise authentication
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add SSO Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add SSO Provider</DialogTitle>
              <DialogDescription>
                Configure a new Single Sign-On provider
              </DialogDescription>
            </DialogHeader>
            <SSOProviderForm
              onSubmit={handleAddConfiguration}
              onCancel={() => setShowAddDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {configurations.map((config) => (
          <Card key={config.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <CardTitle className="text-lg">{config.name}</CardTitle>
                <Badge variant={config.enabled ? "default" : "secondary"}>
                  {config.enabled ? "Enabled" : "Disabled"}
                </Badge>
                {config.isDefault && <Badge variant="outline">Default</Badge>}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(enabled) =>
                    handleToggleProvider(config.id, enabled)
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConfiguration(config.id)}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedConfig(config)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteConfiguration(config.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Provider:
                  </span>
                  <span className="text-sm font-medium">{config.provider}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Created:
                  </span>
                  <span className="text-sm">
                    {new Date(config.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {testResults.has(config.id) && (
                  <Alert className="mt-2">
                    <div className="flex items-center">
                      {testResults.get(config.id)?.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <AlertDescription className="ml-2">
                        {testResults.get(config.id)?.success
                          ? "Configuration test passed"
                          : testResults.get(config.id)?.error}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedConfig && (
        <Dialog
          open={!!selectedConfig}
          onOpenChange={() => setSelectedConfig(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configure {selectedConfig.name}</DialogTitle>
              <DialogDescription>
                Update SSO provider settings
              </DialogDescription>
            </DialogHeader>
            <SSOProviderForm
              initialConfig={selectedConfig}
              onSubmit={async (provider, settings) => {
                await ssoIntegrationService.updateSSOConfiguration(
                  selectedConfig.id,
                  settings
                );
                await loadConfigurations();
                setSelectedConfig(null);
                toast({
                  title: "Success",
                  description: "SSO configuration updated successfully",
                });
              }}
              onCancel={() => setSelectedConfig(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface SSOProviderFormProps {
  initialConfig?: SSOConfiguration;
  onSubmit: (provider: SSOProvider, settings: any) => Promise<void>;
  onCancel: () => void;
}

function SSOProviderForm({
  initialConfig,
  onSubmit,
  onCancel,
}: SSOProviderFormProps) {
  const [provider, setProvider] = useState<SSOProvider>(
    initialConfig?.provider || SSOProvider.OAUTH_GOOGLE
  );
  const [settings, setSettings] = useState<any>(initialConfig?.settings || {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(provider, settings);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="provider">Provider Type</Label>
        <Select
          value={provider}
          onValueChange={(value) => setProvider(value as SSOProvider)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SSOProvider.OAUTH_GOOGLE}>
              Google OAuth
            </SelectItem>
            <SelectItem value={SSOProvider.OAUTH_MICROSOFT}>
              Microsoft OAuth
            </SelectItem>
            <SelectItem value={SSOProvider.SAML}>SAML</SelectItem>
            <SelectItem value={SSOProvider.LDAP}>LDAP</SelectItem>
            <SelectItem value={SSOProvider.OKTA}>Okta</SelectItem>
            <SelectItem value={SSOProvider.AUTH0}>Auth0</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={provider} className="w-full">
        <TabsContent value={SSOProvider.OAUTH_GOOGLE} className="space-y-4">
          <div>
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              value={settings.clientId || ""}
              onChange={(e) =>
                setSettings({ ...settings, clientId: e.target.value })
              }
              placeholder="Google OAuth Client ID"
            />
          </div>
          <div>
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              value={settings.clientSecret || ""}
              onChange={(e) =>
                setSettings({ ...settings, clientSecret: e.target.value })
              }
              placeholder="Google OAuth Client Secret"
            />
          </div>
          <div>
            <Label htmlFor="redirectUri">Redirect URI</Label>
            <Input
              id="redirectUri"
              value={settings.redirectUri || ""}
              onChange={(e) =>
                setSettings({ ...settings, redirectUri: e.target.value })
              }
              placeholder="https://yourdomain.com/auth/google/callback"
            />
          </div>
        </TabsContent>

        <TabsContent value={SSOProvider.SAML} className="space-y-4">
          <div>
            <Label htmlFor="entryPoint">Entry Point URL</Label>
            <Input
              id="entryPoint"
              value={settings.samlSettings?.entryPoint || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  samlSettings: {
                    ...settings.samlSettings,
                    entryPoint: e.target.value,
                  },
                })
              }
              placeholder="https://idp.example.com/sso/saml"
            />
          </div>
          <div>
            <Label htmlFor="certificate">Certificate</Label>
            <Textarea
              id="certificate"
              value={settings.samlSettings?.certificate || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  samlSettings: {
                    ...settings.samlSettings,
                    certificate: e.target.value,
                  },
                })
              }
              placeholder="-----BEGIN CERTIFICATE-----"
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="issuer">Issuer</Label>
            <Input
              id="issuer"
              value={settings.samlSettings?.issuer || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  samlSettings: {
                    ...settings.samlSettings,
                    issuer: e.target.value,
                  },
                })
              }
              placeholder="https://yourdomain.com"
            />
          </div>
        </TabsContent>

        <TabsContent value={SSOProvider.LDAP} className="space-y-4">
          <div>
            <Label htmlFor="ldapUrl">LDAP URL</Label>
            <Input
              id="ldapUrl"
              value={settings.ldapSettings?.url || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ldapSettings: {
                    ...settings.ldapSettings,
                    url: e.target.value,
                  },
                })
              }
              placeholder="ldap://ldap.example.com:389"
            />
          </div>
          <div>
            <Label htmlFor="bindDN">Bind DN</Label>
            <Input
              id="bindDN"
              value={settings.ldapSettings?.bindDN || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ldapSettings: {
                    ...settings.ldapSettings,
                    bindDN: e.target.value,
                  },
                })
              }
              placeholder="cn=admin,dc=example,dc=com"
            />
          </div>
          <div>
            <Label htmlFor="searchBase">Search Base</Label>
            <Input
              id="searchBase"
              value={settings.ldapSettings?.searchBase || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ldapSettings: {
                    ...settings.ldapSettings,
                    searchBase: e.target.value,
                  },
                })
              }
              placeholder="ou=users,dc=example,dc=com"
            />
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {initialConfig ? "Update" : "Add"} Configuration
        </Button>
      </DialogFooter>
    </form>
  );
}
