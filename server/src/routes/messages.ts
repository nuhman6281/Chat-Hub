import { Router } from "express";
import { storage } from "../../storage";
import { ensureAuthenticated } from "../../auth";

const router = Router();

// ... existing routes ...

// Get reactions for a message
router.get("/:messageId/reactions", ensureAuthenticated, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    if (!messageId) {
      return res.status(400).json({ message: "Message ID is required" });
    }

    const message = await storage.getMessage(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const reactions = await storage.getMessageReactions(messageId);
    res.json(reactions);
  } catch (error) {
    console.error("Error getting message reactions:", error);
    res.status(500).json({ message: "Failed to get message reactions" });
  }
});

// Toggle a reaction on a message
router.post("/:messageId/reactions", ensureAuthenticated, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    if (!messageId) {
      return res.status(400).json({ message: "Message ID is required" });
    }

    const { emoji, name } = req.body;
    if (!emoji || !name) {
      return res.status(400).json({ message: "Emoji and name are required" });
    }

    const message = await storage.getMessage(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const reaction = await storage.toggleReaction(
      messageId,
      req.user.id,
      emoji,
      name
    );
    res.json(reaction);
  } catch (error) {
    console.error("Error toggling reaction:", error);
    res.status(500).json({ message: "Failed to toggle reaction" });
  }
});

export default router;
