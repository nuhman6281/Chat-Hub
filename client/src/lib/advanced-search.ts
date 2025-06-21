/**
 * Advanced Search System
 * Provides global search, advanced filtering, file content search, and search analytics
 */

export interface SearchFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  users?: number[];
  channels?: number[];
  messageTypes?: MessageType[];
  fileTypes?: string[];
  hasAttachments?: boolean;
  isStarred?: boolean;
  isUnread?: boolean;
  mentions?: boolean;
  fromMe?: boolean;
  sortBy?: SortOption;
  sortOrder?: "asc" | "desc";
}

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  FILE = "file",
  VOICE = "voice",
  VIDEO = "video",
  SYSTEM = "system",
}

export enum SortOption {
  RELEVANCE = "relevance",
  DATE = "date",
  AUTHOR = "author",
  CHANNEL = "channel",
}

export interface SearchResult {
  id: number;
  type: "message" | "file" | "channel" | "user";
  title: string;
  content: string;
  excerpt: string;
  highlights: string[];
  score: number;
  metadata: SearchResultMetadata;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SearchResultMetadata {
  messageId?: number;
  channelId?: number;
  userId?: number;
  fileId?: number;
  fileType?: string;
  fileSize?: number;
  author?: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  channel?: {
    id: number;
    name: string;
    isPrivate: boolean;
  };
  context?: {
    before: string;
    after: string;
  };
}

export interface SearchResults {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  totalCount: number;
  facets: SearchFacets;
  suggestions: string[];
  executionTime: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface SearchFacets {
  users: Array<{ id: number; name: string; count: number }>;
  channels: Array<{ id: number; name: string; count: number }>;
  messageTypes: Array<{ type: MessageType; count: number }>;
  fileTypes: Array<{ type: string; count: number }>;
  dateRanges: Array<{ range: string; count: number }>;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
  notifications: boolean;
}

export interface SearchSuggestion {
  text: string;
  type: "query" | "filter" | "user" | "channel";
  score: number;
  metadata?: any;
}

export interface SearchAnalytics {
  popularQueries: Array<{ query: string; count: number }>;
  searchTrends: Array<{ date: string; count: number }>;
  averageResponseTime: number;
  userSearchActivity: Array<{ userId: number; searchCount: number }>;
  failedQueries: Array<{ query: string; count: number; lastAttempt: Date }>;
}

class AdvancedSearchService {
  private searchHistory: string[] = [];
  private savedSearches: Map<string, SavedSearch> = new Map();
  private searchAnalytics: SearchAnalytics | null = null;
  private searchWorker: Worker | null = null;

  constructor() {
    this.loadSearchHistory();
    this.loadSavedSearches();
    this.initializeSearchWorker();
  }

  /**
   * Perform global search across all content
   */
  async globalSearch(
    query: string,
    filters: SearchFilters = {},
    options: {
      limit?: number;
      cursor?: string;
      includeContext?: boolean;
    } = {}
  ): Promise<SearchResults> {
    const startTime = Date.now();

    try {
      // Add to search history
      this.addToSearchHistory(query);

      // Build search request
      const searchRequest = {
        query: query.trim(),
        filters: this.sanitizeFilters(filters),
        limit: options.limit || 20,
        cursor: options.cursor,
        includeContext: options.includeContext || true,
      };

      // Perform search
      const response = await fetch("/api/search/global", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(searchRequest),
      });

      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const results = await response.json();
      const executionTime = Date.now() - startTime;

      // Process and enhance results
      const processedResults: SearchResults = {
        ...results,
        executionTime,
        results: results.results.map((result: any) =>
          this.enhanceSearchResult(result, query)
        ),
        suggestions: await this.generateSearchSuggestions(query, results),
      };

      // Update analytics
      this.updateSearchAnalytics(query, executionTime, results.totalCount > 0);

      return processedResults;
    } catch (error) {
      console.error("Global search failed:", error);
      const executionTime = Date.now() - startTime;

      // Update failed search analytics
      this.updateSearchAnalytics(query, executionTime, false);

      throw error;
    }
  }

  /**
   * Search within file contents using OCR and text extraction
   */
  async fileContentSearch(
    query: string,
    fileTypes: string[] = [],
    options: {
      limit?: number;
      includeOCR?: boolean;
      includeMetadata?: boolean;
    } = {}
  ): Promise<SearchResults> {
    const searchRequest = {
      query: query.trim(),
      fileTypes,
      limit: options.limit || 10,
      includeOCR: options.includeOCR || true,
      includeMetadata: options.includeMetadata || true,
    };

    const response = await fetch("/api/search/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(searchRequest),
    });

    if (!response.ok) {
      throw new Error("File content search failed");
    }

    const results = await response.json();
    return {
      ...results,
      results: results.results.map((result: any) =>
        this.enhanceSearchResult(result, query)
      ),
    };
  }

  /**
   * Quick search with auto-complete suggestions
   */
  async quickSearch(
    query: string,
    limit: number = 5
  ): Promise<SearchSuggestion[]> {
    if (query.length < 2) {
      return this.getRecentSearchSuggestions();
    }

    const response = await fetch("/api/search/suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ query, limit }),
    });

    if (!response.ok) {
      return this.getLocalSearchSuggestions(query);
    }

    return await response.json();
  }

  /**
   * Save a search for future use
   */
  async saveSearch(
    name: string,
    query: string,
    filters: SearchFilters,
    enableNotifications: boolean = false
  ): Promise<SavedSearch> {
    const savedSearch: SavedSearch = {
      id: this.generateSearchId(),
      name,
      query,
      filters,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0,
      notifications: enableNotifications,
    };

    this.savedSearches.set(savedSearch.id, savedSearch);
    this.saveSavedSearches();

    // Save to server
    await fetch("/api/search/saved", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(savedSearch),
    });

    return savedSearch;
  }

  /**
   * Execute a saved search
   */
  async executeSavedSearch(searchId: string): Promise<SearchResults> {
    const savedSearch = this.savedSearches.get(searchId);
    if (!savedSearch) {
      throw new Error("Saved search not found");
    }

    // Update usage statistics
    savedSearch.lastUsed = new Date();
    savedSearch.useCount++;
    this.saveSavedSearches();

    return this.globalSearch(savedSearch.query, savedSearch.filters);
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(searchId: string): Promise<void> {
    this.savedSearches.delete(searchId);
    this.saveSavedSearches();

    await fetch(`/api/search/saved/${searchId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(): Promise<SearchAnalytics> {
    if (this.searchAnalytics) {
      return this.searchAnalytics;
    }

    const response = await fetch("/api/search/analytics", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch search analytics");
    }

    this.searchAnalytics = await response.json();
    return this.searchAnalytics!;
  }

  /**
   * Advanced search with complex queries
   */
  async advancedSearch(searchQuery: {
    must?: string[];
    should?: string[];
    mustNot?: string[];
    filters: SearchFilters;
    boost?: { [field: string]: number };
  }): Promise<SearchResults> {
    const response = await fetch("/api/search/advanced", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(searchQuery),
    });

    if (!response.ok) {
      throw new Error("Advanced search failed");
    }

    const results = await response.json();
    return {
      ...results,
      results: results.results.map((result: any) =>
        this.enhanceSearchResult(result, searchQuery.must?.join(" ") || "")
      ),
    };
  }

  /**
   * Search with natural language processing
   */
  async naturalLanguageSearch(
    query: string,
    context?: {
      currentChannel?: number;
      recentMessages?: number[];
      userIntent?: string;
    }
  ): Promise<SearchResults> {
    const response = await fetch("/api/search/natural", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ query, context }),
    });

    if (!response.ok) {
      throw new Error("Natural language search failed");
    }

    return await response.json();
  }

  /**
   * Real-time search as user types
   */
  async realtimeSearch(
    query: string,
    debounceMs: number = 300
  ): Promise<SearchResults> {
    return new Promise((resolve, reject) => {
      // Clear previous timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      this.searchTimeout = setTimeout(async () => {
        try {
          const results = await this.globalSearch(query, {}, { limit: 10 });
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }, debounceMs);
    });
  }

  private searchTimeout: NodeJS.Timeout | null = null;

  /**
   * Private helper methods
   */
  private enhanceSearchResult(result: any, query: string): SearchResult {
    return {
      ...result,
      highlights: this.generateHighlights(result.content, query),
      excerpt: this.generateExcerpt(result.content, query),
    };
  }

  private generateHighlights(content: string, query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const highlights: string[] = [];

    words.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      const matches = content.match(regex);
      if (matches) {
        highlights.push(...matches);
      }
    });

    return Array.from(new Set(highlights));
  }

  private generateExcerpt(
    content: string,
    query: string,
    maxLength: number = 200
  ): string {
    const words = query.toLowerCase().split(/\s+/);
    const firstMatch = words.find((word) =>
      content.toLowerCase().includes(word.toLowerCase())
    );

    if (!firstMatch) {
      return (
        content.substring(0, maxLength) +
        (content.length > maxLength ? "..." : "")
      );
    }

    const index = content.toLowerCase().indexOf(firstMatch.toLowerCase());
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, start + maxLength);

    let excerpt = content.substring(start, end);

    if (start > 0) excerpt = "..." + excerpt;
    if (end < content.length) excerpt = excerpt + "...";

    return excerpt;
  }

  private async generateSearchSuggestions(
    query: string,
    results: any
  ): Promise<string[]> {
    // Generate suggestions based on search results and history
    const suggestions: string[] = [];

    // Add related queries from search history
    const relatedQueries = this.searchHistory.filter(
      (h) => h.toLowerCase().includes(query.toLowerCase()) && h !== query
    );
    suggestions.push(...relatedQueries.slice(0, 3));

    // Add suggestions based on result facets
    if (results.facets) {
      results.facets.users?.slice(0, 2).forEach((user: any) => {
        suggestions.push(`from:${user.name}`);
      });

      results.facets.channels?.slice(0, 2).forEach((channel: any) => {
        suggestions.push(`in:${channel.name}`);
      });
    }

    return Array.from(new Set(suggestions));
  }

  private getRecentSearchSuggestions(): SearchSuggestion[] {
    return this.searchHistory.slice(-5).map((query) => ({
      text: query,
      type: "query" as const,
      score: 1.0,
    }));
  }

  private getLocalSearchSuggestions(query: string): SearchSuggestion[] {
    return this.searchHistory
      .filter((h) => h.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map((text) => ({
        text,
        type: "query" as const,
        score: 0.8,
      }));
  }

  private sanitizeFilters(filters: SearchFilters): SearchFilters {
    const sanitized = { ...filters };

    // Validate date ranges
    if (sanitized.dateRange) {
      if (sanitized.dateRange.start > sanitized.dateRange.end) {
        [sanitized.dateRange.start, sanitized.dateRange.end] = [
          sanitized.dateRange.end,
          sanitized.dateRange.start,
        ];
      }
    }

    // Remove empty arrays
    if (sanitized.users?.length === 0) delete sanitized.users;
    if (sanitized.channels?.length === 0) delete sanitized.channels;
    if (sanitized.messageTypes?.length === 0) delete sanitized.messageTypes;
    if (sanitized.fileTypes?.length === 0) delete sanitized.fileTypes;

    return sanitized;
  }

  private addToSearchHistory(query: string): void {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) return;

    // Remove if already exists
    const index = this.searchHistory.indexOf(trimmedQuery);
    if (index > -1) {
      this.searchHistory.splice(index, 1);
    }

    // Add to beginning
    this.searchHistory.unshift(trimmedQuery);

    // Keep only last 50 searches
    this.searchHistory = this.searchHistory.slice(0, 50);

    this.saveSearchHistory();
  }

  private updateSearchAnalytics(
    query: string,
    executionTime: number,
    successful: boolean
  ): void {
    // Update local analytics cache
    // This would typically be sent to the server
    console.log("Search analytics:", { query, executionTime, successful });
  }

  private initializeSearchWorker(): void {
    if ("Worker" in window) {
      try {
        this.searchWorker = new Worker("/workers/search-worker.js");
        this.searchWorker.onmessage = (event) => {
          // Handle worker responses
          console.log("Search worker response:", event.data);
        };
      } catch (error) {
        console.warn("Failed to initialize search worker:", error);
      }
    }
  }

  private generateSearchId(): string {
    return `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadSearchHistory(): void {
    const stored = localStorage.getItem("searchHistory");
    if (stored) {
      try {
        this.searchHistory = JSON.parse(stored);
      } catch {
        this.searchHistory = [];
      }
    }
  }

  private saveSearchHistory(): void {
    localStorage.setItem("searchHistory", JSON.stringify(this.searchHistory));
  }

  private loadSavedSearches(): void {
    const stored = localStorage.getItem("savedSearches");
    if (stored) {
      try {
        const searches = JSON.parse(stored);
        this.savedSearches = new Map(searches);
      } catch {
        this.savedSearches = new Map();
      }
    }
  }

  private saveSavedSearches(): void {
    const searches = Array.from(this.savedSearches.entries());
    localStorage.setItem("savedSearches", JSON.stringify(searches));
  }

  /**
   * Public getters
   */
  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  getSavedSearches(): SavedSearch[] {
    return Array.from(this.savedSearches.values());
  }

  clearSearchHistory(): void {
    this.searchHistory = [];
    this.saveSearchHistory();
  }
}

export const advancedSearchService = new AdvancedSearchService();
