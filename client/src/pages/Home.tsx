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
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { useCall } from '@/contexts/CallContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Menu, Send, Plus, Hash, LogOut, User, Users, MessageSquare, Phone, Video } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
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

// Create workspace/channel form schemas
const createWorkspaceSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
});

const createChannelSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false),
});

type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>;
type CreateChannelValues = z.infer<typeof createChannelSchema>;

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { 
    isConnected,
    activeWorkspace, 
    workspaces, 
    activeChannel, 
    channels, 
    activeDM, 
    directMessages, 
    messages, 
    isLoadingMessages,
    setActiveWorkspace,
    setActiveChannel,
    setActiveDM,
    sendMessage,
    createWorkspace,
    createChannel,
  } = useChat();
  const callContext = useCall();
  const { toast } = useToast();
  
  const [messageInput, setMessageInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'channels' | 'direct'>('channels');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  
  // Form for creating a workspace
  const workspaceForm = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });
  
  // Form for creating a channel
  const channelForm = useForm<CreateChannelValues>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      name: '',
      description: '',
      isPrivate: false,
    },
  });
  
  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageInput.trim()) return;
    
    const success = await sendMessage(messageInput);
    if (success) {
      setMessageInput('');
    }
  };
  
  // Handle creating a workspace
  const onCreateWorkspace = async (values: CreateWorkspaceValues) => {
    const newWorkspace = await createWorkspace(values.name, values.description);
    if (newWorkspace) {
      setIsCreatingWorkspace(false);
      workspaceForm.reset();
    }
  };
  
  // Handle creating a channel
  const onCreateChannel = async (values: CreateChannelValues) => {
    const newChannel = await createChannel(
      values.name, 
      values.isPrivate, 
      values.description
    );
    if (newChannel) {
      setIsCreatingChannel(false);
      channelForm.reset();
    }
  };
  
  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };
  
  // Format message timestamp
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Render connection status
  const renderConnectionStatus = () => {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <div 
          className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
        />
        {isConnected ? 'Connected' : 'Disconnected'}
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
                <span className="font-medium">{user?.displayName}</span>
                <span className="text-xs text-muted-foreground">@{user?.username}</span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(prev => !prev)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Workspaces Section */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            {sidebarOpen && <h2 className="text-sm font-semibold">Workspaces</h2>}
            <Dialog open={isCreatingWorkspace} onOpenChange={setIsCreatingWorkspace}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a new workspace</DialogTitle>
                  <DialogDescription>
                    Create a new workspace to organize your channels and conversations.
                  </DialogDescription>
                </DialogHeader>
                <Form {...workspaceForm}>
                  <form onSubmit={workspaceForm.handleSubmit(onCreateWorkspace)} className="space-y-4">
                    <FormField
                      control={workspaceForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter workspace name" {...field} />
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
                            <Input placeholder="Enter workspace description" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreatingWorkspace(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Create Workspace</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="space-y-1">
            {workspaces.map(workspace => (
              <Button
                key={workspace.id}
                variant={activeWorkspace?.id === workspace.id ? 'secondary' : 'ghost'}
                className={`w-full justify-start ${!sidebarOpen && 'justify-center p-2'}`}
                onClick={() => setActiveWorkspace(workspace)}
              >
                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center mr-3">
                  {workspace.iconUrl ? (
                    <img 
                      src={workspace.iconUrl} 
                      alt={workspace.name} 
                      className="w-6 h-6 rounded" 
                    />
                  ) : (
                    <span className="font-medium text-primary">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {sidebarOpen && <span className="truncate">{workspace.name}</span>}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Channels/Direct Messages Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {sidebarOpen && (
            <Tabs 
              defaultValue="channels" 
              value={activeTab} 
              onValueChange={(value) => setActiveTab(value as 'channels' | 'direct')}
              className="w-full"
            >
              <div className="px-4 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="channels" className="flex-1">Channels</TabsTrigger>
                  <TabsTrigger value="direct" className="flex-1">Direct</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="channels" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">CHANNELS</span>
                  {activeWorkspace && (
                    <Dialog open={isCreatingChannel} onOpenChange={setIsCreatingChannel}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create a new channel</DialogTitle>
                          <DialogDescription>
                            Create a new channel in the {activeWorkspace.name} workspace.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...channelForm}>
                          <form onSubmit={channelForm.handleSubmit(onCreateChannel)} className="space-y-4">
                            <FormField
                              control={channelForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter channel name" {...field} />
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
                                    <Input placeholder="Enter channel description" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreatingChannel(false)}
                              >
                                Cancel
                              </Button>
                              <Button type="submit">Create Channel</Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
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
                        <Avatar className="h-5 w-5 mr-2">
                          <AvatarImage src={dm.otherUser.avatarUrl || ''} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(dm.otherUser.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start">
                          <span className="truncate text-sm">{dm.otherUser.displayName}</span>
                        </div>
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
              <h2 className="font-semibold">{activeChannel.name}</h2>
              {activeChannel.description && (
                <>
                  <Separator orientation="vertical" className="h-5 mx-2" />
                  <p className="text-sm text-muted-foreground">{activeChannel.description}</p>
                </>
              )}
            </div>
          )}
          
          {activeDM && (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={activeDM.otherUser.avatarUrl || ''} />
                <AvatarFallback>
                  {getInitials(activeDM.otherUser.displayName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold">{activeDM.otherUser.displayName}</h2>
                <div className="flex items-center text-xs text-muted-foreground">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    activeDM.otherUser.status === 'online' ? 'bg-green-500' : 'bg-amber-500'
                  } mr-1`} />
                  {activeDM.otherUser.status === 'online' ? 'Online' : 'Away'}
                </div>
              </div>
            </div>
          )}
          
          {!activeChannel && !activeDM && (
            <div className="text-muted-foreground">
              Select a channel or conversation
            </div>
          )}
          
          <div className="ml-auto flex items-center gap-2">
            {activeDM && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-green-600"
                  onClick={() => callContext.startCall(activeDM.otherUser.id, 'audio')}
                  title="Audio call"
                >
                  <Phone className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-blue-600"
                  onClick={() => callContext.startCall(activeDM.otherUser.id, 'video')}
                  title="Video call"
                >
                  <Video className="h-5 w-5" />
                </Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        {/* Messages */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {(!activeChannel && !activeDM) ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <h2 className="text-2xl font-bold mb-2">Welcome to ChatHub</h2>
                  <p className="text-muted-foreground max-w-md">
                    Select a channel or direct message from the sidebar to start chatting.
                    {!workspaces.length && " Or create your first workspace to get started."}
                  </p>
                  {!workspaces.length && (
                    <Button 
                      className="mt-4" 
                      onClick={() => setIsCreatingWorkspace(true)}
                    >
                      Create Workspace
                    </Button>
                  )}
                </div>
              ) : (
                <ScrollArea className="flex-1 p-4 flex flex-col-reverse">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className="flex gap-3 group">
                        <Avatar className="h-8 w-8 mt-1">
                          <AvatarImage src={message.user.avatarUrl || ''} />
                          <AvatarFallback>
                            {getInitials(message.user.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {message.user.displayName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatMessageTime(message.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{message.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              
              {/* Message Input */}
              {(activeChannel || activeDM) && (
                <div className="p-4 border-t">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={`Message ${
                        activeChannel 
                          ? `#${activeChannel.name}` 
                          : activeDM?.otherUser.displayName
                      }`}
                      className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={!messageInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}