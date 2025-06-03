// Smart message search with fuzzy matching
export interface SearchResult {
  messageId: number;
  content: string;
  userName: string;
  channelName?: string;
  dmUserName?: string;
  timestamp: Date;
  messageType: string;
  score: number;
  highlightedContent: string;
}

export class MessageSearch {
  private static normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private static calculateFuzzyScore(query: string, text: string): number {
    const normalizedQuery = this.normalizeText(query);
    const normalizedText = this.normalizeText(text);
    
    if (normalizedText.includes(normalizedQuery)) {
      return 1.0; // Exact match gets highest score
    }
    
    // Calculate Levenshtein distance for fuzzy matching
    const distance = this.levenshteinDistance(normalizedQuery, normalizedText);
    const maxLength = Math.max(normalizedQuery.length, normalizedText.length);
    
    if (maxLength === 0) return 0;
    
    const similarity = 1 - (distance / maxLength);
    return similarity > 0.6 ? similarity : 0; // Threshold for relevance
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private static highlightMatches(text: string, query: string): string {
    const normalizedQuery = this.normalizeText(query);
    const words = normalizedQuery.split(' ');
    
    let highlighted = text;
    words.forEach(word => {
      if (word.length > 2) {
        const regex = new RegExp(`(${word})`, 'gi');
        highlighted = highlighted.replace(regex, '<mark>$1</mark>');
      }
    });
    
    return highlighted;
  }

  static searchMessages(messages: any[], query: string): SearchResult[] {
    if (!query.trim()) return [];
    
    const results: SearchResult[] = [];
    
    messages.forEach(message => {
      const contentScore = this.calculateFuzzyScore(query, message.content || '');
      const userScore = this.calculateFuzzyScore(query, message.user?.displayName || '');
      
      const maxScore = Math.max(contentScore, userScore);
      
      if (maxScore > 0) {
        results.push({
          messageId: message.id,
          content: message.content || '',
          userName: message.user?.displayName || 'Unknown',
          channelName: message.channel?.name,
          dmUserName: message.directMessage?.otherUser?.displayName,
          timestamp: new Date(message.createdAt),
          messageType: message.messageType,
          score: maxScore,
          highlightedContent: this.highlightMatches(message.content || '', query)
        });
      }
    });
    
    // Sort by score (highest first) and then by timestamp (newest first)
    return results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }
}