/**
 * Analytics Dashboard Component
 * Comprehensive business intelligence and reporting interface
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  analyticsPlatformService,
  UserEngagementMetrics,
  CommunicationAnalytics,
  SystemPerformanceMetrics,
  CallAnalytics,
} from "@/lib/analytics-platform";
import {
  BarChart3,
  Users,
  MessageSquare,
  Phone,
  TrendingUp,
  TrendingDown,
  Activity,
  Database,
  Download,
  RefreshCw,
} from "lucide-react";

export default function AnalyticsDashboard() {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [userMetrics, setUserMetrics] = useState<UserEngagementMetrics | null>(
    null
  );
  const [commMetrics, setCommMetrics] = useState<CommunicationAnalytics | null>(
    null
  );
  const [systemMetrics, setSystemMetrics] =
    useState<SystemPerformanceMetrics | null>(null);
  const [callMetrics, setCallMetrics] = useState<CallAnalytics | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<any>(null);

  useEffect(() => {
    loadAllMetrics();
    const interval = setInterval(loadRealTimeMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadAllMetrics = async () => {
    setLoading(true);
    try {
      const [user, comm, system, calls] = await Promise.all([
        analyticsPlatformService.getUserEngagementMetrics(timeRange),
        analyticsPlatformService.getCommunicationAnalytics(timeRange),
        analyticsPlatformService.getSystemPerformanceMetrics(),
        analyticsPlatformService.getCallAnalytics(timeRange),
      ]);

      setUserMetrics(user);
      setCommMetrics(comm);
      setSystemMetrics(system);
      setCallMetrics(calls);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRealTimeMetrics = async () => {
    try {
      const metrics = await analyticsPlatformService.getRealTimeMetrics();
      setRealTimeMetrics(metrics);
    } catch (error) {
      console.error("Failed to load real-time metrics:", error);
    }
  };

  const handleExportData = async (
    type: string,
    format: "csv" | "json" | "xlsx"
  ) => {
    try {
      const result = await analyticsPlatformService.exportData(type, format, {
        timeRange,
      });
      // Create download link
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.download = `${type}-analytics.${format}`;
      link.click();

      toast({
        title: "Export Started",
        description: "Your analytics data is being downloaded",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export analytics data",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive insights and business intelligence
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAllMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportData("all", "csv")}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Real-time Metrics */}
      {realTimeMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realTimeMetrics.activeUsers}
              </div>
              <Badge variant="secondary" className="text-xs">
                Live
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Calls
              </CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realTimeMetrics.currentCalls}
              </div>
              <Badge variant="secondary" className="text-xs">
                Live
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Messages/Min
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realTimeMetrics.messagesPerMinute}
              </div>
              <Badge variant="secondary" className="text-xs">
                Live
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Load</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realTimeMetrics.systemLoad}%
              </div>
              <Progress value={realTimeMetrics.systemLoad} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">User Engagement</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="calls">Calls & Meetings</TabsTrigger>
          <TabsTrigger value="system">System Performance</TabsTrigger>
        </TabsList>

        {/* User Engagement Tab */}
        <TabsContent value="users" className="space-y-4">
          {userMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Total Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {userMetrics.totalUsers.toLocaleString()}
                  </div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-500">
                      +{userMetrics.userGrowthRate}% growth
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Daily Active</span>
                      <span className="font-bold">
                        {userMetrics.dailyActiveUsers}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Weekly Active</span>
                      <span className="font-bold">
                        {userMetrics.weeklyActiveUsers}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Active</span>
                      <span className="font-bold">
                        {userMetrics.monthlyActiveUsers}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Engagement Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Retention Rate</span>
                      <span className="font-bold">
                        {userMetrics.userRetentionRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Session</span>
                      <span className="font-bold">
                        {Math.round(userMetrics.averageSessionDuration / 60)}m
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Messages/User</span>
                      <span className="font-bold">
                        {userMetrics.messagesPerUser}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Communication Tab */}
        <TabsContent value="communication" className="space-y-4">
          {commMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Message Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Messages</span>
                      <span className="font-bold">
                        {commMetrics.totalMessages.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Messages/Day</span>
                      <span className="font-bold">
                        {commMetrics.messagesPerDay.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Response Time</span>
                      <span className="font-bold">
                        {Math.round(commMetrics.averageResponseTime / 60)}m
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Most Active Channels</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {commMetrics.mostActiveChannels
                      .slice(0, 5)
                      .map((channel, index) => (
                        <div
                          key={channel.channelId}
                          className="flex justify-between"
                        >
                          <span className="truncate">#{channel.name}</span>
                          <span className="font-bold">
                            {channel.messageCount}
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Most Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {commMetrics.mostActiveUsers
                      .slice(0, 5)
                      .map((user, index) => (
                        <div key={user.userId} className="flex justify-between">
                          <span className="truncate">@{user.username}</span>
                          <span className="font-bold">{user.messageCount}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Peak Activity Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {commMetrics.peakActivityHours.slice(0, 5).map((hour) => (
                      <div key={hour.hour} className="flex justify-between">
                        <span>{hour.hour}:00</span>
                        <span className="font-bold">{hour.messageCount}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls" className="space-y-4">
          {callMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Phone className="h-5 w-5 mr-2" />
                    Call Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Calls</span>
                      <span className="font-bold">
                        {callMetrics.totalCalls.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate</span>
                      <span className="font-bold">
                        {callMetrics.callSuccessRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Duration</span>
                      <span className="font-bold">
                        {Math.round(callMetrics.averageCallDuration / 60)}m
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Call Quality</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Audio Quality</span>
                      <span className="font-bold">
                        {callMetrics.callQualityMetrics.averageAudioQuality}/5
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Video Quality</span>
                      <span className="font-bold">
                        {callMetrics.callQualityMetrics.averageVideoQuality}/5
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connection Issues</span>
                      <span className="font-bold">
                        {callMetrics.callQualityMetrics.connectionIssues}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Participant Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Avg Participants</span>
                      <span className="font-bold">
                        {callMetrics.participantStatistics.averageParticipants}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Participants</span>
                      <span className="font-bold">
                        {callMetrics.participantStatistics.maxParticipants}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Screen Share Usage</span>
                      <span className="font-bold">
                        {callMetrics.participantStatistics.screenShareUsage}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Popular Call Times</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {callMetrics.mostPopularCallTimes
                      .slice(0, 5)
                      .map((time) => (
                        <div key={time.hour} className="flex justify-between">
                          <span>{time.hour}:00</span>
                          <span className="font-bold">{time.callCount}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* System Performance Tab */}
        <TabsContent value="system" className="space-y-4">
          {systemMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span>Uptime</span>
                        <span className="font-bold">
                          {systemMetrics.uptime}%
                        </span>
                      </div>
                      <Progress value={systemMetrics.uptime} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span>CPU Usage</span>
                        <span className="font-bold">
                          {systemMetrics.cpuUsage}%
                        </span>
                      </div>
                      <Progress value={systemMetrics.cpuUsage} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span>Memory Usage</span>
                        <span className="font-bold">
                          {systemMetrics.memoryUsage}%
                        </span>
                      </div>
                      <Progress value={systemMetrics.memoryUsage} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Database Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Query Time</span>
                      <span className="font-bold">
                        {systemMetrics.databasePerformance.queryTime}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connections</span>
                      <span className="font-bold">
                        {systemMetrics.databasePerformance.connectionCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Slow Queries</span>
                      <span className="font-bold">
                        {systemMetrics.databasePerformance.slowQueries}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Response Time</span>
                      <span className="font-bold">
                        {systemMetrics.averageResponseTime}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Error Rate</span>
                      <span className="font-bold">
                        {systemMetrics.errorRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Throughput</span>
                      <span className="font-bold">
                        {systemMetrics.throughput}/s
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resource Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Disk Usage</span>
                      <span className="font-bold">
                        {systemMetrics.diskUsage}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Network Latency</span>
                      <span className="font-bold">
                        {systemMetrics.networkLatency}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Concurrent Users</span>
                      <span className="font-bold">
                        {systemMetrics.concurrentUsers}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
