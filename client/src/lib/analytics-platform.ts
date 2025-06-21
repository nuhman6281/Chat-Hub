/**
 * Analytics & Reporting Platform
 * Comprehensive business intelligence and insights system
 */

export interface UserEngagementMetrics {
  totalUsers: number;
  activeUsers: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  userRetentionRate: number;
  averageSessionDuration: number;
  messagesPerUser: number;
  callsPerUser: number;
  userGrowthRate: number;
}

export interface CommunicationAnalytics {
  totalMessages: number;
  messagesPerDay: number;
  averageResponseTime: number;
  mostActiveChannels: Array<{
    channelId: number;
    name: string;
    messageCount: number;
  }>;
  mostActiveUsers: Array<{
    userId: number;
    username: string;
    messageCount: number;
  }>;
  peakActivityHours: Array<{ hour: number; messageCount: number }>;
  messageTypes: Record<string, number>;
  emojiUsage: Array<{ emoji: string; count: number }>;
}

export interface SystemPerformanceMetrics {
  uptime: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  concurrentUsers: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkLatency: number;
  databasePerformance: {
    queryTime: number;
    connectionCount: number;
    slowQueries: number;
  };
}

export interface CallAnalytics {
  totalCalls: number;
  callDuration: number;
  averageCallDuration: number;
  callSuccessRate: number;
  callQualityMetrics: {
    averageAudioQuality: number;
    averageVideoQuality: number;
    connectionIssues: number;
  };
  mostPopularCallTimes: Array<{ hour: number; callCount: number }>;
  participantStatistics: {
    averageParticipants: number;
    maxParticipants: number;
    screenShareUsage: number;
  };
}

export interface FileAnalytics {
  totalFiles: number;
  totalFileSize: number;
  averageFileSize: number;
  fileTypes: Record<string, number>;
  mostSharedFiles: Array<{ fileName: string; shareCount: number }>;
  storageUsageByChannel: Array<{ channelId: number; usage: number }>;
}

export interface CustomDashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  isPublic: boolean;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: "chart" | "metric" | "table" | "gauge" | "map";
  title: string;
  dataSource: string;
  configuration: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  type:
    | "user_engagement"
    | "communication"
    | "system_performance"
    | "call_analytics"
    | "custom";
  schedule: "daily" | "weekly" | "monthly" | "quarterly";
  recipients: string[];
  format: "pdf" | "csv" | "json";
  filters: Record<string, any>;
  lastGenerated: Date;
  nextScheduled: Date;
}

class AnalyticsPlatformService {
  private dashboards: Map<string, CustomDashboard> = new Map();
  private reports: Map<string, AnalyticsReport> = new Map();

  constructor() {
    this.loadDashboards();
    this.loadReports();
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(
    timeRange: string = "30d"
  ): Promise<UserEngagementMetrics> {
    try {
      const response = await fetch(
        `/api/analytics/user-engagement?timeRange=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get user engagement metrics");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get user engagement metrics:", error);
      throw error;
    }
  }

  /**
   * Get communication analytics
   */
  async getCommunicationAnalytics(
    timeRange: string = "30d"
  ): Promise<CommunicationAnalytics> {
    try {
      const response = await fetch(
        `/api/analytics/communication?timeRange=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get communication analytics");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get communication analytics:", error);
      throw error;
    }
  }

  /**
   * Get system performance metrics
   */
  async getSystemPerformanceMetrics(): Promise<SystemPerformanceMetrics> {
    try {
      const response = await fetch("/api/analytics/system-performance", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get system performance metrics");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get system performance metrics:", error);
      throw error;
    }
  }

  /**
   * Get call analytics
   */
  async getCallAnalytics(timeRange: string = "30d"): Promise<CallAnalytics> {
    try {
      const response = await fetch(
        `/api/analytics/calls?timeRange=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get call analytics");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get call analytics:", error);
      throw error;
    }
  }

  /**
   * Get file analytics
   */
  async getFileAnalytics(timeRange: string = "30d"): Promise<FileAnalytics> {
    try {
      const response = await fetch(
        `/api/analytics/files?timeRange=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get file analytics");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get file analytics:", error);
      throw error;
    }
  }

  /**
   * Create custom dashboard
   */
  async createDashboard(
    dashboard: Omit<CustomDashboard, "id" | "createdAt" | "updatedAt">
  ): Promise<CustomDashboard> {
    try {
      const response = await fetch("/api/analytics/dashboards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(dashboard),
      });

      if (!response.ok) {
        throw new Error("Failed to create dashboard");
      }

      const createdDashboard = await response.json();
      this.dashboards.set(createdDashboard.id, createdDashboard);
      return createdDashboard;
    } catch (error) {
      console.error("Failed to create dashboard:", error);
      throw error;
    }
  }

  /**
   * Update dashboard
   */
  async updateDashboard(
    dashboardId: string,
    updates: Partial<CustomDashboard>
  ): Promise<CustomDashboard> {
    try {
      const response = await fetch(`/api/analytics/dashboards/${dashboardId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update dashboard");
      }

      const updatedDashboard = await response.json();
      this.dashboards.set(dashboardId, updatedDashboard);
      return updatedDashboard;
    } catch (error) {
      console.error("Failed to update dashboard:", error);
      throw error;
    }
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(dashboardId: string): Promise<void> {
    try {
      const response = await fetch(`/api/analytics/dashboards/${dashboardId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete dashboard");
      }

      this.dashboards.delete(dashboardId);
    } catch (error) {
      console.error("Failed to delete dashboard:", error);
      throw error;
    }
  }

  /**
   * Get dashboards
   */
  getDashboards(): CustomDashboard[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Get dashboard by ID
   */
  getDashboard(dashboardId: string): CustomDashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  /**
   * Create analytics report
   */
  async createReport(
    report: Omit<AnalyticsReport, "id" | "lastGenerated" | "nextScheduled">
  ): Promise<AnalyticsReport> {
    try {
      const response = await fetch("/api/analytics/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        throw new Error("Failed to create report");
      }

      const createdReport = await response.json();
      this.reports.set(createdReport.id, createdReport);
      return createdReport;
    } catch (error) {
      console.error("Failed to create report:", error);
      throw error;
    }
  }

  /**
   * Generate report
   */
  async generateReport(reportId: string): Promise<{ downloadUrl: string }> {
    try {
      const response = await fetch(
        `/api/analytics/reports/${reportId}/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to generate report:", error);
      throw error;
    }
  }

  /**
   * Get reports
   */
  getReports(): AnalyticsReport[] {
    return Array.from(this.reports.values());
  }

  /**
   * Export analytics data
   */
  async exportData(
    type: string,
    format: "csv" | "json" | "xlsx",
    filters?: Record<string, any>
  ): Promise<{ downloadUrl: string }> {
    try {
      const response = await fetch("/api/analytics/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ type, format, filters }),
      });

      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to export data:", error);
      throw error;
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<{
    activeUsers: number;
    currentCalls: number;
    messagesPerMinute: number;
    systemLoad: number;
  }> {
    try {
      const response = await fetch("/api/analytics/realtime", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get real-time metrics");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get real-time metrics:", error);
      throw error;
    }
  }

  /**
   * Load dashboards from server
   */
  private async loadDashboards(): Promise<void> {
    try {
      const response = await fetch("/api/analytics/dashboards", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const dashboards = await response.json();
        this.dashboards.clear();
        dashboards.forEach((dashboard: CustomDashboard) => {
          this.dashboards.set(dashboard.id, dashboard);
        });
      }
    } catch (error) {
      console.error("Failed to load dashboards:", error);
    }
  }

  /**
   * Load reports from server
   */
  private async loadReports(): Promise<void> {
    try {
      const response = await fetch("/api/analytics/reports", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const reports = await response.json();
        this.reports.clear();
        reports.forEach((report: AnalyticsReport) => {
          this.reports.set(report.id, report);
        });
      }
    } catch (error) {
      console.error("Failed to load reports:", error);
    }
  }
}

// Export singleton instance
export const analyticsPlatformService = new AnalyticsPlatformService();
export default analyticsPlatformService;
