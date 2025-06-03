import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthWrapper';
import { useChat } from '@/contexts/ChatContext';
import { useToast } from '@/hooks/use-toast';
import { CallModal } from '@/components/ui/call-modal';
import { Loader2, Menu, Send, Plus, Hash, LogOut, User, Users, MessageSquare, Phone, Video } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area-fixed';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import EnhancedMessageInput from '@/components/chat/EnhancedMessageInput';
import { InviteUserDialog } from '@/components/InviteUserDialog';
import { CreateUserDialog } from '@/components/CreateUserDialog';

// Create workspace/channel form schemas
const createWorkspaceSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
});

const createChannelSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
});

type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>;
type CreateChannelValues = z.infer<typeof createChannelSchema>;

export default function Home() {
  const { user } = useAuth();
  const { 
    workspaces, 
    activeWorkspace, 
    setActiveWorkspace, 
    channels, 
    activeChannel, 
    setActiveChannel,
    directMessages = [],
    activeDM = null,
    setActiveDM = () => {},
    messages, 
    sendMessage, 
    isConnected,
    createWorkspace,
    createChannel,
    currentCall,
    isCallModalOpen,
    initiateCall,
    answerCall,
    hangupCall,
    setIsCallModalOpen
  } = useChat();
  const { toast } = useToast();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('channels');
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showInviteToWorkspace, setShowInviteToWorkspace] = useState(false);

  // Form hooks
  const workspaceForm = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const channelForm = useForm<CreateChannelValues>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const handleCreateWorkspace = async (values: CreateWorkspaceValues) => {
    try {
      await createWorkspace(values.name, values.description);
      setShowCreateWorkspace(false);
      workspaceForm.reset();
      toast({
        title: "Success",
        description: "Workspace created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create workspace",
        variant: "destructive",
      });
    }
  };

  const handleCreateChannel = async (values: CreateChannelValues) => {
    if (!activeWorkspace) return;
    
    try {
      await createChannel({
        ...values,
        workspaceId: activeWorkspace.id,
      });
      setShowCreateChannel(false);
      channelForm.reset();
      toast({
        title: "Success",
        description: "Channel created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create channel",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderConnectionStatus = () => {
    const getStatusColor = () => {
      if (isConnected) return 'text-green-500';
      return 'text-red-500';
    };

    const getStatusText = () => {
      if (isConnected) return 'Connected';
      return 'Disconnected';
    };

    return (
      <div className="px-2 py-1 text-xs">
        <div className={`flex items-center gap-2 ${getStatusColor()}`}>
          <div className="w-2 h-2 rounded-full bg-current"></div>
          {sidebarOpen && <span>{getStatusText()}</span>}
        </div>
      </div>
    );
  };
  
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div 
        className={`border-r flex flex-col ${
          sidebarOpen ? 'w-64' : 'w-20'
        } transition-all duration-300 h-full`}
      >
        {/* User Section */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={user?.avatarUrl || ''} />
              <AvatarFallback>{user?.displayName ? getInitials(user.displayName) : 'U'}</AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-medium text-sm">{user?.displayName}</span>
                <span className="text-xs text-muted-foreground">{user?.status || 'Online'}</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Workspaces */}
        {sidebarOpen && (
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">WORKSPACES</span>
              <Dialog open={showCreateWorkspace} onOpenChange={setShowCreateWorkspace}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Workspace</DialogTitle>
                    <DialogDescription>
                      Create a new workspace for your team
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...workspaceForm}>
                    <form onSubmit={workspaceForm.handleSubmit(handleCreateWorkspace)} className="space-y-4">
                      <FormField
                        control={workspaceForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Workspace name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={workspaceForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Workspace description" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit">Create Workspace</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="mt-2 space-y-1">
              {workspaces.map(workspace => (
                <Button
                  key={workspace.id}
                  variant={activeWorkspace?.id === workspace.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start h-8 px-2"
                  onClick={() => setActiveWorkspace(workspace)}
                >
                  <span className="truncate text-sm">{workspace.name}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex-1 overflow-hidden">
          {sidebarOpen && activeWorkspace && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-2 mx-4 mt-2">
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="direct">Direct</TabsTrigger>
              </TabsList>
              
              <TabsContent value="channels" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">CHANNELS</span>
                  <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Channel</DialogTitle>
                        <DialogDescription>
                          Create a new channel in {activeWorkspace?.name}
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...channelForm}>
                        <form onSubmit={channelForm.handleSubmit(handleCreateChannel)} className="space-y-4">
                          <FormField
                            control={channelForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Channel name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={channelForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Channel description" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit">Create Channel</Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <ScrollArea className="flex-1 px-2">
                  <div className="space-y-[2px] py-2">
                    {channels.map(channel => (
                      <Button
                        key={channel.id}
                        variant={activeChannel?.id === channel.id ? 'secondary' : 'ghost'}
                        className="w-full justify-start h-8 px-2"
                        onClick={() => setActiveChannel(channel)}
                      >
                        <Hash className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="truncate text-sm">{channel.name}</span>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="direct" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2">
                  <span className="text-xs font-medium text-muted-foreground">DIRECT MESSAGES</span>
                </div>
                
                <ScrollArea className="flex-1 px-2">
                  <div className="space-y-[2px] py-2">
                    {directMessages.map(dm => (
                      <Button
                        key={dm.id}
                        variant={activeDM?.id === dm.id ? 'secondary' : 'ghost'}
                        className="w-full justify-start h-8 px-2"
                        onClick={() => setActiveDM(dm)}
                      >
                        <User className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="truncate text-sm">{dm.otherUser.displayName}</span>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
          
          {!sidebarOpen && (
            <div className="flex-1 overflow-auto py-2">
              <div className="flex flex-col items-center space-y-2">
                <Button 
                  variant={activeTab === 'channels' ? 'secondary' : 'ghost'} 
                  size="icon"
                  onClick={() => setActiveTab('channels')}
                >
                  <Users className="h-5 w-5" />
                </Button>
                <Button 
                  variant={activeTab === 'direct' ? 'secondary' : 'ghost'} 
                  size="icon"
                  onClick={() => setActiveTab('direct')}
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Connection status and logout */}
        <div className="mt-auto border-t">
          {renderConnectionStatus()}
          <div className="p-2">
            <Button 
              variant="ghost" 
              className={`w-full justify-${sidebarOpen ? 'start' : 'center'}`}
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {sidebarOpen && <span>Log out</span>}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Channel/DM Header */}
        <header className="h-16 border-b flex items-center px-6">
          {activeChannel && (
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">{activeChannel.name}</h1>
              {activeChannel.description && (
                <span className="text-sm text-muted-foreground">- {activeChannel.description}</span>
              )}
            </div>
          )}
          
          {activeDM && (
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">{activeDM.otherUser.displayName}</h1>
            </div>
          )}
          
          {!activeChannel && !activeDM && (
            <h1 className="text-lg font-semibold">Welcome to ChatHub</h1>
          )}
          
          <div className="ml-auto flex items-center gap-2">
            {activeDM && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    console.log('Audio call button clicked for user:', activeDM.otherUser.id);
                    initiateCall(activeDM.otherUser.id, 'audio');
                  }}
                  title="Start audio call"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    console.log('Video call button clicked for user:', activeDM.otherUser.id);
                    initiateCall(activeDM.otherUser.id, 'video');
                  }}
                  title="Start video call"
                >
                  <Video className="h-4 w-4" />
                </Button>
              </>
            )}
            
            {(activeChannel || activeDM) && (
              <>
                {/* User Management Buttons */}
                
                {/* User Management Buttons */}
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowCreateUser(true)}
                  title="Create new user"
                >
                  <User className="h-4 w-4" />
                </Button>
                
                {/* Test Direct Message Button */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={async () => {
                    console.log('Starting DM with user 4');
                    const dm = await startDirectMessage(4);
                    if (dm) {
                      console.log('DM created:', dm);
                      setActiveDM(dm);
                      setActiveChannel(null);
                      toast({
                        title: "Direct message started",
                        description: `Started conversation with ${dm.otherUser.displayName}`
                      });
                    }
                  }}
                  title="Start DM with User 4 (for testing calls)"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Test DM
                </Button>
                
                {activeChannel && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowInviteUser(true)}
                    title="Invite user to channel"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                )}
                
                {activeWorkspace && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowInviteToWorkspace(true)}
                    title="Invite user to workspace"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </header>
        
        {/* Messages Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {(activeChannel || activeDM) ? (
            <>
              <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className="flex gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={message.user.avatarUrl || ''} />
                        <AvatarFallback>
                          {getInitials(message.user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{message.user.displayName}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm">{message.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {/* Message Input */}
              <div className="border-t p-4">
                <EnhancedMessageInput 
                  onSendMessage={sendMessage}
                  disabled={!isConnected}
                  placeholder={
                    activeChannel 
                      ? `Message #${activeChannel.name}` 
                      : `Message ${activeDM?.otherUser.displayName}`
                  }
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Welcome to ChatHub</h2>
                <p className="text-muted-foreground">Select a channel or start a direct message to begin chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* User Invitation Dialogs */}
      <InviteUserDialog
        isOpen={showInviteUser}
        onClose={() => setShowInviteUser(false)}
        targetType="channel"
        targetId={activeChannel?.id || 1}
        targetName={activeChannel?.name || 'Channel'}
      />
      
      <InviteUserDialog
        isOpen={showInviteToWorkspace}
        onClose={() => setShowInviteToWorkspace(false)}
        targetType="workspace"
        targetId={activeWorkspace?.id || 1}
        targetName={activeWorkspace?.name || 'Workspace'}
      />
      
      <CreateUserDialog
        isOpen={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        onUserCreated={(user) => {
          toast({
            title: "User created",
            description: `${user.displayName} has been created successfully`,
          });
        }}
      />

      {/* Call Modal */}
      <CallModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        callData={currentCall}
        onAnswer={answerCall}
        onHangup={hangupCall}
      />
    </div>
  );
}