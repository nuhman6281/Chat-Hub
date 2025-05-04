import { Reaction } from "@shared/schema";

export interface IStorage {
  // ... existing methods ...

  // Reaction methods
  getMessageReactions(messageId: number): Promise<Reaction[]>;
  toggleReaction(
    messageId: number,
    userId: number,
    emoji: string,
    name: string
  ): Promise<Reaction[]>;
}
