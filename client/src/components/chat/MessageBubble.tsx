import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  MessageSquare, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Download,
  Play,
  Image as ImageIcon,
  FileText,
  Smile
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MessageBubbleProps {
  message: {
    id: number;
    content: string;
    messageType: string;
    mediaUrl?: string;
    mediaType?: string;
    mediaSize?: number;
    userId: number;
    createdAt: string;
    isEdited?: boolean;
    reactions?: string[];
    replyToId?: number;
    user: {
      id: number;
      username: string;
      displayName: string;
      avatarUrl?: string;
    };
  };
  currentUserId: number;
  onReply?: (messageId: number) => void;
  onEdit?: (messageId: number, content: string) => void;
  onDelete?: (messageId: number) => void;
  onReact?: (messageId: number, emoji: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  currentUserId, 
  onReply, 
  onEdit, 
  onDelete, 
  onReact 
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const isOwnMessage = message.userId === currentUserId;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderMediaContent = () => {
    if (!message.mediaUrl) return null;

    switch (message.messageType) {
      case 'image':
        return (
          <div className="mt-2">
            <img 
              src={message.mediaUrl} 
              alt="Shared image" 
              className="max-w-xs rounded-lg cursor-pointer hover:opacity-90"
              onClick={() => window.open(message.mediaUrl, '_blank')}
            />
          </div>
        );
      
      case 'video':
        return (
          <div className="mt-2">
            <video 
              controls 
              className="max-w-xs rounded-lg"
              src={message.mediaUrl}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );
      
      case 'voice':
        return (
          <div className="mt-2 flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
            <Button size="sm" variant="ghost">
              <Play className="h-4 w-4" />
            </Button>
            <audio controls className="flex-1">
              <source src={message.mediaUrl} type={message.mediaType} />
              Your browser does not support the audio element.
            </audio>
          </div>
        );
      
      case 'file':
        return (
          <div className="mt-2 flex items-center space-x-3 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
            <FileText className="h-8 w-8 text-blue-500" />
            <div className="flex-1">
              <p className="font-medium text-sm">{message.mediaUrl.split('/').pop()}</p>
              {message.mediaSize && (
                <p className="text-xs text-gray-500">{formatFileSize(message.mediaSize)}</p>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => window.open(message.mediaUrl, '_blank')}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  const commonReactions = ['👍', '❤️', '😄', '😮', '😢', '😡'];

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2 max-w-[70%]`}>
        {!isOwnMessage && (
          <Avatar className="w-8 h-8 mt-1">
            <AvatarImage src={message.user.avatarUrl} alt={message.user.displayName} />
            <AvatarFallback>
              {message.user.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {!isOwnMessage && (
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {message.user.displayName}
              </span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
              </span>
            </div>
          )}
          
          <div 
            className={`relative group px-4 py-2 rounded-lg ${
              isOwnMessage 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            {message.isEdited && (
              <span className="text-xs opacity-70 ml-2">(edited)</span>
            )}
            
            {renderMediaContent()}
            
            {/* Message Actions */}
            <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center space-x-1 bg-white dark:bg-gray-800 rounded-full p-1 shadow-lg">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowReactions(!showReactions)}
                >
                  <Smile className="h-3 w-3" />
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => onReply?.(message.id)}
                >
                  <MessageSquare className="h-3 w-3" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isOwnMessage && (
                      <>
                        <DropdownMenuItem onClick={() => onEdit?.(message.id, message.content)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onDelete?.(message.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Quick Reactions */}
            {showReactions && (
              <div className="absolute top-full left-0 mt-1 flex space-x-1 bg-white dark:bg-gray-800 rounded-full p-1 shadow-lg z-10">
                {commonReactions.map((emoji) => (
                  <Button
                    key={emoji}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-sm"
                    onClick={() => {
                      onReact?.(message.id, emoji);
                      setShowReactions(false);
                    }}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            )}
          </div>
          
          {/* Reactions Display */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {message.reactions.map((reaction, index) => (
                <span 
                  key={index}
                  className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full text-xs cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-500"
                  onClick={() => onReact?.(message.id, reaction)}
                >
                  {reaction}
                </span>
              ))}
            </div>
          )}
          
          {isOwnMessage && (
            <span className="text-xs text-gray-500 mt-1">
              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;