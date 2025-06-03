import { useState, useEffect, useMemo } from 'react';
import { Search, X, MessageCircle, Hash, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSearch, SearchResult } from '@/lib/search';
import { formatDistanceToNow } from 'date-fns';

interface MessageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: any[];
  onMessageSelect: (messageId: number, channelId?: number, directMessageId?: number) => void;
}

export function MessageSearchModal({ isOpen, onClose, messages, onMessageSelect }: MessageSearchModalProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    
    setIsSearching(true);
    const results = MessageSearch.searchMessages(messages, query);
    setIsSearching(false);
    
    return results;
  }, [messages, query]);

  const handleResultClick = (result: SearchResult) => {
    const message = messages.find(m => m.id === result.messageId);
    if (message) {
      onMessageSelect(result.messageId, message.channelId, message.directMessageId);
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Search Messages</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages, users, or content..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <ScrollArea className="h-96">
            <div className="space-y-2">
              {isSearching && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Searching...</div>
                </div>
              )}
              
              {!isSearching && query && searchResults.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">No messages found</div>
                </div>
              )}
              
              {!isSearching && searchResults.map((result) => (
                <div
                  key={result.messageId}
                  className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{result.userName}</span>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          {result.channelName ? (
                            <>
                              <Hash className="h-3 w-3" />
                              <span>{result.channelName}</span>
                            </>
                          ) : (
                            <>
                              <MessageCircle className="h-3 w-3" />
                              <span>Direct Message</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div 
                        className="text-sm"
                        dangerouslySetInnerHTML={{ __html: result.highlightedContent }}
                      />
                      
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNow(result.timestamp, { addSuffix: true })}</span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {Math.round(result.score * 100)}% match
                    </div>
                  </div>
                </div>
              ))}
              
              {!query && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">Start typing to search messages</div>
                    <div className="text-xs mt-1">Search by content, user names, or keywords</div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}