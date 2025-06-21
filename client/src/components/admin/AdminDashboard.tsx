/**
 * Admin Dashboard Component
 * Comprehensive administrative interface for EventSentinel
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthWrapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  MessageSquare,
  Activity,
  Settings,
  Shield,
  BarChart3,
  Database,
  Server,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Ban,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Clock,
  TrendingUp,
  TrendingDown,
  Globe,
  Smartphone,
  Monitor,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalChannels: number;
  totalWorkspaces: number;
  storageUsed: number;
  storageLimit: number;
  systemUptime: number;
  averageResponseTime: number;
  errorRate: number;
}

interface UserManagement {
  id: number;
  username: string;
  displayName: string;
  email: string;
  status: "active" | "suspended" | "banned";
  role: "user" | "admin" | "moderator";
  lastActive: Date;
  joinedAt: Date;
  messageCount: number;
  workspaceCount: number;
  isOnline: boolean;
}

interface SystemAlert {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  description: string;
  timestamp: Date;
  resolved: boolean;
  severity: "low" | "medium" | "high" | "critical";
}

interface AuditLogEntry {
  id: string;
  userId: number;
  action: string;
  resource: string;
  details: any;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // State management
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserManagement[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserManagement | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Check admin permissions
  useEffect(() => {
    if (!user || user.role !== "admin") {
      // Redirect to unauthorized page
      return;
    }
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load all admin data in parallel
      const [statsRes, usersRes, alertsRes, auditRes] = await Promise.all([
        fetch("/api/admin/stats", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }),
        fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }),
        fetch("/api/admin/alerts", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }),
        fetch("/api/admin/audit-logs", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch (error) {
      console.error("Failed to load admin data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (
    userId: number,
    action: string,
    data?: any
  ) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `User ${action} completed successfully`,
        });
        loadDashboardData(); // Refresh data
      } else {
        throw new Error(`Failed to ${action} user`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} user`,
        variant: "destructive",
      });
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/resolve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        setAlerts(
          alerts.map((alert) =>
            alert.id === alertId ? { ...alert, resolved: true } : alert
          )
        );
        toast({
          title: "Alert Resolved",
          description: "Alert has been marked as resolved",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    }
  };

  const exportData = async (type: string) => {
    try {
      const response = await fetch(`/api/admin/export/${type}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}-export-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus =
      filterStatus === "all" || user.status === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your EventSentinel instance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportData("users")}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button onClick={loadDashboardData}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalUsers.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.activeUsers} active users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalMessages.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {stats.totalChannels} channels
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.storageUsed / 1024 / 1024 / 1024).toFixed(1)}GB
              </div>
              <Progress
                value={(stats.storageUsed / stats.storageLimit) * 100}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {((stats.storageUsed / stats.storageLimit) * 100).toFixed(1)}%
                used
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                System Health
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {(100 - stats.errorRate).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.averageResponseTime}ms avg response
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Alerts */}
      {alerts.filter((alert) => !alert.resolved).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts
                .filter((alert) => !alert.resolved)
                .map((alert) => (
                  <Alert
                    key={alert.id}
                    className={
                      alert.severity === "critical"
                        ? "border-red-500"
                        : alert.severity === "high"
                        ? "border-orange-500"
                        : alert.severity === "medium"
                        ? "border-yellow-500"
                        : "border-blue-500"
                    }
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="flex items-center justify-between">
                      {alert.title}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            alert.severity === "critical"
                              ? "destructive"
                              : alert.severity === "high"
                              ? "destructive"
                              : alert.severity === "medium"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {alert.severity}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveAlert(alert.id)}
                        >
                          Resolve
                        </Button>
                      </div>
                    </AlertTitle>
                    <AlertDescription>
                      {alert.description}
                      <div className="text-xs text-muted-foreground mt-1">
                        {alert.timestamp.toLocaleString()}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Admin Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage users, roles, and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Users Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {user.displayName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {user.isOnline && (
                                <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 border-2 border-white rounded-full" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">
                                {user.displayName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                @{user.username}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.role === "admin"
                                ? "destructive"
                                : user.role === "moderator"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.status === "active"
                                ? "default"
                                : user.status === "suspended"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {user.lastActive.toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.messageCount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowUserDialog(true);
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUserAction(user.id, "promote")
                                }
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Promote Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.status === "active" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUserAction(user.id, "suspend")
                                  }
                                  className="text-orange-600"
                                >
                                  <UserMinus className="mr-2 h-4 w-4" />
                                  Suspend User
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUserAction(user.id, "reactivate")
                                  }
                                  className="text-green-600"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Reactivate User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleUserAction(user.id, "ban")}
                                className="text-red-600"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Ban User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Daily Active Users</span>
                    <span className="font-bold">{stats?.activeUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Messages Today</span>
                    <span className="font-bold">1,234</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Calls Today</span>
                    <span className="font-bold">56</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Uptime</span>
                    <span className="font-bold">99.9%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Response Time</span>
                    <span className="font-bold">
                      {stats?.averageResponseTime}ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Error Rate</span>
                    <span className="font-bold">
                      {stats?.errorRate.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold">Server Status</h4>
                  <div className="flex items-center justify-between">
                    <span>CPU Usage</span>
                    <span>45%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Memory Usage</span>
                    <span>62%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Disk Usage</span>
                    <span>78%</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">Database</h4>
                  <div className="flex items-center justify-between">
                    <span>Connections</span>
                    <span>24/100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Query Performance</span>
                    <span>Good</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Backup Status</span>
                    <span className="text-green-600">✓ Current</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Recent security and administrative events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 border rounded-lg"
                    >
                      <div
                        className={`h-2 w-2 rounded-full mt-2 ${
                          log.success ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{log.action}</div>
                        <div className="text-sm text-muted-foreground">
                          {log.resource} • {log.timestamp.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          IP: {log.ipAddress}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure global system settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="registration">
                      Allow User Registration
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Allow new users to register accounts
                    </p>
                  </div>
                  <Switch id="registration" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="invites">Require Invitations</Label>
                    <p className="text-sm text-muted-foreground">
                      Users can only join via invitation
                    </p>
                  </div>
                  <Switch id="invites" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="analytics">Analytics Collection</Label>
                    <p className="text-sm text-muted-foreground">
                      Collect usage analytics for insights
                    </p>
                  </div>
                  <Switch id="analytics" defaultChecked />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <Label htmlFor="storage-limit">Storage Limit (GB)</Label>
                  <Input
                    id="storage-limit"
                    type="number"
                    defaultValue="100"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="message-retention">
                    Message Retention (days)
                  </Label>
                  <Input
                    id="message-retention"
                    type="number"
                    defaultValue="365"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button>Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Detailed information about {selectedUser?.displayName}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Username</Label>
                  <p className="text-sm">{selectedUser.username}</p>
                </div>
                <div>
                  <Label>Display Name</Label>
                  <p className="text-sm">{selectedUser.displayName}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm">{selectedUser.email}</p>
                </div>
                <div>
                  <Label>Role</Label>
                  <Badge>{selectedUser.role}</Badge>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge>{selectedUser.status}</Badge>
                </div>
                <div>
                  <Label>Joined</Label>
                  <p className="text-sm">
                    {selectedUser.joinedAt.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label>Messages Sent</Label>
                  <p className="text-sm">
                    {selectedUser.messageCount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label>Workspaces</Label>
                  <p className="text-sm">{selectedUser.workspaceCount}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
