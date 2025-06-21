/**
 * Push Notification Service
 * Handles browser push notifications, service worker registration, and notification settings
 */

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  desktopEnabled: boolean;
  soundEnabled: boolean;
  mentionOnly: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  channelSettings: Map<number, NotificationLevel>;
}

export enum NotificationLevel {
  ALL = "all",
  MENTIONS = "mentions",
  NONE = "none",
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private settings: NotificationSettings;
  private vapidPublicKey = "YOUR_VAPID_PUBLIC_KEY"; // Replace with actual VAPID key

  constructor() {
    this.settings = this.loadSettings();
    this.initializeServiceWorker();
  }

  /**
   * Initialize service worker for push notifications
   */
  private async initializeServiceWorker(): Promise<void> {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      try {
        this.registration = await navigator.serviceWorker.register("/sw.js");
        console.log("Service Worker registered successfully");

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener(
          "message",
          this.handleServiceWorkerMessage.bind(this)
        );
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    }
  }

  /**
   * Request notification permission and subscribe to push notifications
   */
  async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }

    let permission = Notification.permission;

    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission === "granted") {
      await this.subscribeToPush();
      this.updateSettings({ ...this.settings, pushEnabled: true });
      return true;
    }

    return false;
  }

  /**
   * Subscribe to push notifications
   */
  private async subscribeToPush(): Promise<void> {
    if (!this.registration) {
      throw new Error("Service Worker not registered");
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      throw error;
    }
  }

  /**
   * Send push subscription to server
   */
  private async sendSubscriptionToServer(
    subscription: PushSubscription
  ): Promise<void> {
    const response = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send subscription to server");
    }
  }

  /**
   * Show local notification
   */
  async showNotification(payload: PushNotificationPayload): Promise<void> {
    if (!this.shouldShowNotification(payload)) {
      return;
    }

    if (this.settings.pushEnabled && this.registration) {
      // Show via service worker for better control
      await this.registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || "/icons/notification-icon.png",
        badge: payload.badge || "/icons/badge-icon.png",
        tag: payload.tag,
        data: payload.data,
        requireInteraction: true,
        silent: !this.settings.soundEnabled,
      } as NotificationOptions);
    } else if (
      this.settings.desktopEnabled &&
      Notification.permission === "granted"
    ) {
      // Fallback to basic notification
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || "/icons/notification-icon.png",
        tag: payload.tag,
        data: payload.data,
        silent: !this.settings.soundEnabled,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }

  /**
   * Check if notification should be shown based on settings
   */
  private shouldShowNotification(payload: PushNotificationPayload): boolean {
    // Check quiet hours
    if (this.settings.quietHours.enabled && this.isInQuietHours()) {
      return false;
    }

    // Check channel-specific settings
    const channelId = payload.data?.channelId;
    if (channelId && this.settings.channelSettings.has(channelId)) {
      const channelLevel = this.settings.channelSettings.get(channelId);

      if (channelLevel === NotificationLevel.NONE) {
        return false;
      }

      if (
        channelLevel === NotificationLevel.MENTIONS &&
        !payload.data?.isMention
      ) {
        return false;
      }
    }

    // Check mention-only setting
    if (this.settings.mentionOnly && !payload.data?.isMention) {
      return false;
    }

    return true;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = this.settings.quietHours.start
      .split(":")
      .map(Number);
    const [endHour, endMin] = this.settings.quietHours.end
      .split(":")
      .map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case "NOTIFICATION_CLICKED":
        this.handleNotificationClick(payload);
        break;
      case "NOTIFICATION_CLOSED":
        this.handleNotificationClose(payload);
        break;
    }
  }

  /**
   * Handle notification click
   */
  private handleNotificationClick(data: any): void {
    // Navigate to relevant channel/conversation
    if (data.channelId) {
      window.location.href = `/channel/${data.channelId}`;
    } else if (data.directMessageId) {
      window.location.href = `/dm/${data.directMessageId}`;
    }
  }

  /**
   * Handle notification close
   */
  private handleNotificationClose(data: any): void {
    // Track notification interaction analytics
    console.log("Notification closed:", data);
  }

  /**
   * Update notification settings
   */
  updateSettings(newSettings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  /**
   * Get current notification settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Set channel-specific notification level
   */
  setChannelNotificationLevel(
    channelId: number,
    level: NotificationLevel
  ): void {
    this.settings.channelSettings.set(channelId, level);
    this.saveSettings();
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): NotificationSettings {
    const stored = localStorage.getItem("notificationSettings");
    const defaultSettings: NotificationSettings = {
      pushEnabled: false,
      emailEnabled: true,
      desktopEnabled: true,
      soundEnabled: true,
      mentionOnly: false,
      quietHours: {
        enabled: false,
        start: "22:00",
        end: "08:00",
      },
      channelSettings: new Map(),
    };

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...defaultSettings,
          ...parsed,
          channelSettings: new Map(parsed.channelSettings || []),
        };
      } catch {
        return defaultSettings;
      }
    }

    return defaultSettings;
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    const settingsToSave = {
      ...this.settings,
      channelSettings: Array.from(this.settings.channelSettings.entries()),
    };
    localStorage.setItem(
      "notificationSettings",
      JSON.stringify(settingsToSave)
    );
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    if (!this.registration) return;

    try {
      const subscription =
        await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        // Notify server
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });
      }

      this.updateSettings({ ...this.settings, pushEnabled: false });
    } catch (error) {
      console.error("Failed to unsubscribe from push notifications:", error);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
