/**
 * Webhook System for Third-Party Integrations
 */

export enum WebhookEvent {
  MESSAGE_SENT = "message.sent",
  MESSAGE_UPDATED = "message.updated",
  USER_JOINED = "user.joined",
  USER_LEFT = "user.left",
  CHANNEL_CREATED = "channel.created",
  CALL_STARTED = "call.started",
  CALL_ENDED = "call.ended",
  FILE_UPLOADED = "file.uploaded",
}

export interface WebhookConfiguration {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  secret: string;
  headers: Record<string, string>;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
  };
  createdAt: Date;
  successCount: number;
  failureCount: number;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: Date;
  data: any;
  user?: { id: number; username: string; displayName: string };
  workspace?: { id: number; name: string };
  channel?: { id: number; name: string };
}

class WebhookSystemService {
  private webhooks: Map<string, WebhookConfiguration> = new Map();

  async createWebhook(
    config: Omit<
      WebhookConfiguration,
      "id" | "createdAt" | "successCount" | "failureCount"
    >
  ): Promise<WebhookConfiguration> {
    const response = await fetch("/api/webhooks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) throw new Error("Failed to create webhook");

    const webhook = await response.json();
    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async updateWebhook(
    webhookId: string,
    updates: Partial<WebhookConfiguration>
  ): Promise<WebhookConfiguration> {
    const response = await fetch(`/api/webhooks/${webhookId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error("Failed to update webhook");

    const webhook = await response.json();
    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const response = await fetch(`/api/webhooks/${webhookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });

    if (!response.ok) throw new Error("Failed to delete webhook");
    this.webhooks.delete(webhookId);
  }

  getWebhooks(): WebhookConfiguration[] {
    return Array.from(this.webhooks.values());
  }

  async testWebhook(
    webhookId: string
  ): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      return response.ok
        ? await response.json()
        : { success: false, error: "Test failed" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async triggerCustomEvent(eventName: string, data: any): Promise<void> {
    const response = await fetch("/api/webhooks/trigger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ event: eventName, data }),
    });

    if (!response.ok) throw new Error("Failed to trigger custom event");
  }
}

export const webhookSystemService = new WebhookSystemService();
export default webhookSystemService;
