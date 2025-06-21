/**
 * Notification Settings Component
 * Provides comprehensive notification management UI
 */

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  pushNotificationService,
  NotificationLevel,
  type NotificationSettings,
} from "@/lib/push-notifications";
import {
  Bell,
  BellOff,
  Clock,
  Mail,
  Monitor,
  Settings,
  Smartphone,
  Volume2,
  VolumeX,
  Users,
  Hash,
  MessageSquare,
  Phone,
  Video,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
} from "lucide-react";

interface ChannelNotificationSetting {
  channelId: number;
  channelName: string;
  level: NotificationLevel;
  isPrivate: boolean;
}

export default function NotificationSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelSettings, setChannelSettings] = useState<
    ChannelNotificationSetting[]
  >([]);
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const currentSettings = pushNotificationService.getSettings();
      setSettings(currentSettings);

      // Load channel-specific settings
      await loadChannelSettings();
    } catch (error) {
      console.error("Failed to load notification settings:", error);
      toast({
        title: "Error",
        description: "Failed to load notification settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadChannelSettings = async () => {
    try {
      // Fetch channels user is member of
      const response = await fetch("/api/channels/user", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const channels = await response.json();
        const channelNotificationSettings: ChannelNotificationSetting[] =
          channels.map((channel: any) => ({
            channelId: channel.id,
            channelName: channel.name,
            level:
              settings?.channelSettings.get(channel.id) ||
              NotificationLevel.ALL,
            isPrivate: channel.isPrivate,
          }));
        setChannelSettings(channelNotificationSettings);
      }
    } catch (error) {
      console.error("Failed to load channel settings:", error);
    }
  };

  const updateSettings = (updates: Partial<NotificationSettings>) => {
    if (!settings) return;

    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    pushNotificationService.updateSettings(updates);

    toast({
      title: "Settings Updated",
      description: "Your notification preferences have been saved",
    });
  };

  const enablePushNotifications = async () => {
    try {
      const enabled = await pushNotificationService.requestPermission();
      if (enabled) {
        updateSettings({ pushEnabled: true });
        toast({
          title: "Push Notifications Enabled",
          description: "You will now receive push notifications",
        });
      } else {
        toast({
          title: "Permission Denied",
          description: "Please enable notifications in your browser settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to enable push notifications:", error);
      toast({
        title: "Error",
        description: "Failed to enable push notifications",
        variant: "destructive",
      });
    }
  };

  const disablePushNotifications = async () => {
    try {
      await pushNotificationService.unsubscribe();
      updateSettings({ pushEnabled: false });
      toast({
        title: "Push Notifications Disabled",
        description: "You will no longer receive push notifications",
      });
    } catch (error) {
      console.error("Failed to disable push notifications:", error);
      toast({
        title: "Error",
        description: "Failed to disable push notifications",
        variant: "destructive",
      });
    }
  };

  const updateChannelNotificationLevel = (
    channelId: number,
    level: NotificationLevel
  ) => {
    pushNotificationService.setChannelNotificationLevel(channelId, level);
    setChannelSettings((prev) =>
      prev.map((channel) =>
        channel.channelId === channelId ? { ...channel, level } : channel
      )
    );

    toast({
      title: "Channel Settings Updated",
      description: `Notification level changed for #${
        channelSettings.find((c) => c.channelId === channelId)?.channelName
      }`,
    });
  };

  const sendTestNotification = async () => {
    try {
      await pushNotificationService.showNotification({
        title: "Test Notification",
        body: "This is a test notification from EventSentinel",
        data: { test: true },
      });

      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3000);

      toast({
        title: "Test Notification Sent",
        description: "Check if you received the notification",
      });
    } catch (error) {
      console.error("Failed to send test notification:", error);
      toast({
        title: "Error",
        description: "Failed to send test notification",
        variant: "destructive",
      });
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">
          Failed to load notification settings
        </p>
        <Button onClick={loadSettings} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notification Settings</h2>
          <p className="text-muted-foreground">
            Manage how you receive notifications from EventSentinel
          </p>
        </div>
        <Button
          onClick={sendTestNotification}
          variant="outline"
          disabled={!settings.pushEnabled}
        >
          {testNotificationSent ? (
            <CheckCircle className="h-4 w-4 mr-2" />
          ) : (
            <Bell className="h-4 w-4 mr-2" />
          )}
          Test Notification
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Push Notifications
              </CardTitle>
              <CardDescription>
                Receive notifications even when EventSentinel is closed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Enable Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified of new messages and calls
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {settings.pushEnabled && (
                    <Badge variant="secondary" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  )}
                  <Switch
                    checked={settings.pushEnabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        enablePushNotifications();
                      } else {
                        disablePushNotifications();
                      }
                    }}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    <Label>Desktop Notifications</Label>
                  </div>
                  <Switch
                    checked={settings.desktopEnabled}
                    onCheckedChange={(checked) =>
                      updateSettings({ desktopEnabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <Label>Email Notifications</Label>
                  </div>
                  <Switch
                    checked={settings.emailEnabled}
                    onCheckedChange={(checked) =>
                      updateSettings({ emailEnabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    <Label>Sound Notifications</Label>
                  </div>
                  <Switch
                    checked={settings.soundEnabled}
                    onCheckedChange={(checked) =>
                      updateSettings({ soundEnabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <Label>Only @mentions and DMs</Label>
                  </div>
                  <Switch
                    checked={settings.mentionOnly}
                    onCheckedChange={(checked) =>
                      updateSettings({ mentionOnly: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label>New Messages</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Message Reactions</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Thread Replies</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>File Uploads</Label>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Call Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label>Incoming Calls</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Call Recordings</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Screen Sharing</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Meeting Reminders</Label>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channel Settings */}
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Channel Notifications
              </CardTitle>
              <CardDescription>
                Customize notifications for each channel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {channelSettings.map((channel) => (
                    <div
                      key={channel.channelId}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {channel.channelName}
                          </span>
                        </div>
                        {channel.isPrivate && (
                          <Badge variant="secondary" className="text-xs">
                            Private
                          </Badge>
                        )}
                      </div>
                      <Select
                        value={channel.level}
                        onValueChange={(value: NotificationLevel) =>
                          updateChannelNotificationLevel(
                            channel.channelId,
                            value
                          )
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NotificationLevel.ALL}>
                            <div className="flex items-center gap-2">
                              <Bell className="h-3 w-3" />
                              All messages
                            </div>
                          </SelectItem>
                          <SelectItem value={NotificationLevel.MENTIONS}>
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3" />
                              @mentions only
                            </div>
                          </SelectItem>
                          <SelectItem value={NotificationLevel.NONE}>
                            <div className="flex items-center gap-2">
                              <BellOff className="h-3 w-3" />
                              Nothing
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Settings */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Quiet Hours
              </CardTitle>
              <CardDescription>
                Set times when you don't want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Quiet Hours</Label>
                <Switch
                  checked={settings.quietHours.enabled}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      quietHours: { ...settings.quietHours, enabled: checked },
                    })
                  }
                />
              </div>

              {settings.quietHours.enabled && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={settings.quietHours.start}
                        onChange={(e) =>
                          updateSettings({
                            quietHours: {
                              ...settings.quietHours,
                              start: e.target.value,
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {formatTime(settings.quietHours.start)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={settings.quietHours.end}
                        onChange={(e) =>
                          updateSettings({
                            quietHours: {
                              ...settings.quietHours,
                              end: e.target.value,
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {formatTime(settings.quietHours.end)}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Info className="h-4 w-4" />
                      <span>
                        Quiet hours: {formatTime(settings.quietHours.start)} -{" "}
                        {formatTime(settings.quietHours.end)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Meeting Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>15 minutes before</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>5 minutes before</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>At meeting time</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Email reminders</Label>
                  <Switch />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Advanced Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notification Grouping</Label>
                    <p className="text-sm text-muted-foreground">
                      Group similar notifications together
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-dismiss Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically dismiss notifications after 10 seconds
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Rich Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show message previews and action buttons
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notification Analytics</Label>
                    <p className="text-sm text-muted-foreground">
                      Help improve notifications with usage data
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Notification History</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Clear History
                  </Button>
                  <Button variant="outline" size="sm">
                    Export Settings
                  </Button>
                  <Button variant="outline" size="sm">
                    Reset to Defaults
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Troubleshooting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Browser Support</span>
                  <Badge variant="secondary">
                    {"Notification" in window ? "Supported" : "Not Supported"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Permission Status</span>
                  <Badge
                    variant={
                      Notification.permission === "granted"
                        ? "default"
                        : Notification.permission === "denied"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {Notification.permission}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Service Worker</span>
                  <Badge variant="secondary">
                    {"serviceWorker" in navigator
                      ? "Available"
                      : "Not Available"}
                  </Badge>
                </div>
              </div>

              {Notification.permission === "denied" && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <X className="h-4 w-4" />
                    <span>
                      Notifications are blocked. Please enable them in your
                      browser settings.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
