import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Users, Bookmark, Settings, Phone, Video } from "lucide-react";

// Sample messages for demo
const SAMPLE_MESSAGES = [
  {
    id: 1,
    sender: "Sarah Johnson",
    initials: "SJ",
    message: "Hey team! Just finished the design mockups for the new feature. Would love your feedback!",
    time: "10:34 AM",
    isCurrentUser: false
  },
  {
    id: 2,
    sender: "Alex Chen",
    initials: "AC",
    message: "Looks great! I particularly like the navigation improvements.",
    time: "10:36 AM",
    isCurrentUser: false
  },
  {
    id: 3,
    sender: "You",
    initials: "YO",
    message: "Thanks everyone! I'll incorporate your feedback and finalize it by EOD.",
    time: "10:40 AM",
    isCurrentUser: true
  },
  {
    id: 4,
    sender: "Michael Roberts",
    initials: "MR",
    message: "Could we schedule a quick call to discuss the user flow?",
    time: "10:45 AM",
    isCurrentUser: false
  }
];

// Sample channels for demo
const SAMPLE_CHANNELS = [
  { id: 1, name: "general", unread: 0 },
  { id: 2, name: "design", unread: 3 },
  { id: 3, name: "development", unread: 0 },
  { id: 4, name: "marketing", unread: 1 },
  { id: 5, name: "random", unread: 0 }
];

// Sample direct messages for demo
const SAMPLE_DMS = [
  { id: 1, name: "Sarah Johnson", status: "online", unread: 0 },
  { id: 2, name: "Alex Chen", status: "away", unread: 0 },
  { id: 3, name: "Michael Roberts", status: "offline", unread: 2 },
  { id: 4, name: "Emily Parker", status: "online", unread: 0 }
];

// Sample workspaces for demo
const SAMPLE_WORKSPACES = [
  { id: 1, name: "Design Team", initials: "DT" },
  { id: 2, name: "Marketing", initials: "MK" },
  { id: 3, name: "Engineering", initials: "EN" }
];

export default function TestDemo() {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState(SAMPLE_MESSAGES);
  const [activeTab, setActiveTab] = useState("channels");
  
  const handleSendMessage = () => {
    if (newMessage.trim() === "") return;
    
    const newMsg = {
      id: messages.length + 1,
      sender: "You",
      initials: "YO",
      message: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isCurrentUser: true
    };
    
    setMessages([...messages, newMsg]);
    setNewMessage("");
  };
  
  return (
    <div className="flex h-screen bg-light-100 dark:bg-dark-300">
      {/* Workspace Sidebar */}
      <div className="w-16 bg-light-300 dark:bg-dark-400 flex flex-col items-center py-4 space-y-4">
        {SAMPLE_WORKSPACES.map(workspace => (
          <div 
            key={workspace.id}
            className="w-10 h-10 rounded-md bg-gradient-to-r from-primary to-secondary text-white flex items-center justify-center font-bold cursor-pointer"
          >
            {workspace.initials}
          </div>
        ))}
        
        <div className="w-10 h-10 rounded-md border-2 border-dashed border-light-600 dark:border-dark-600 text-light-600 dark:text-dark-600 flex items-center justify-center mt-auto cursor-pointer">
          +
        </div>
      </div>
      
      {/* Channel Sidebar */}
      <div className="w-64 bg-light-200 dark:bg-dark-500 flex flex-col">
        <div className="p-4 font-bold text-lg border-b border-light-300 dark:border-dark-700">
          Design Team
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-2 pt-4">
            <TabsList className="w-full">
              <TabsTrigger value="channels" className="flex-1">Channels</TabsTrigger>
              <TabsTrigger value="dms" className="flex-1">DMs</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="channels" className="flex-1 overflow-y-auto p-2 space-y-1">
            {SAMPLE_CHANNELS.map(channel => (
              <div 
                key={channel.id}
                className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-light-300 dark:hover:bg-dark-400 cursor-pointer"
              >
                <MessageSquare size={18} />
                <span className="flex-1"># {channel.name}</span>
                {channel.unread > 0 && (
                  <span className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {channel.unread}
                  </span>
                )}
              </div>
            ))}
          </TabsContent>
          
          <TabsContent value="dms" className="flex-1 overflow-y-auto p-2 space-y-1">
            {SAMPLE_DMS.map(dm => (
              <div 
                key={dm.id}
                className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-light-300 dark:hover:bg-dark-400 cursor-pointer"
              >
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {dm.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
                    dm.status === 'online' ? 'bg-green-500' : 
                    dm.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`}></span>
                </div>
                <span className="flex-1">{dm.name}</span>
                {dm.unread > 0 && (
                  <span className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {dm.unread}
                  </span>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
        
        <div className="p-4 flex items-center space-x-2 border-t border-light-300 dark:border-dark-700">
          <Avatar>
            <AvatarFallback>YO</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium">Your Name</div>
            <div className="text-xs text-light-600 dark:text-dark-600">Online</div>
          </div>
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-16 border-b border-light-300 dark:border-dark-700 flex items-center justify-between px-6">
          <div className="flex items-center space-x-2">
            <MessageSquare size={18} />
            <span className="font-medium"># design</span>
            <span className="text-light-600 dark:text-dark-600 text-sm">5 members</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon">
              <Phone size={18} />
            </Button>
            <Button variant="ghost" size="icon">
              <Video size={18} />
            </Button>
            <Button variant="ghost" size="icon">
              <Bookmark size={18} />
            </Button>
            <Button variant="ghost" size="icon">
              <Users size={18} />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings size={18} />
            </Button>
          </div>
        </div>
        
        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isCurrentUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${msg.isCurrentUser ? 'order-1' : 'order-2'}`}>
                {!msg.isCurrentUser && (
                  <div className="flex items-center space-x-2 mb-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">{msg.initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{msg.sender}</span>
                    <span className="text-xs text-light-600 dark:text-dark-600">{msg.time}</span>
                  </div>
                )}
                
                <div className={`p-3 rounded-lg ${
                  msg.isCurrentUser 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-light-300 dark:bg-dark-400 rounded-tl-none'
                }`}>
                  {msg.message}
                </div>
                
                {msg.isCurrentUser && (
                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-light-600 dark:text-dark-600">{msg.time}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Message Input */}
        <div className="p-4 border-t border-light-300 dark:border-dark-700">
          <div className="flex items-end space-x-2">
            <Textarea 
              placeholder="Message #design" 
              className="flex-1 min-h-[60px] max-h-[200px]"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button onClick={handleSendMessage}>Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}