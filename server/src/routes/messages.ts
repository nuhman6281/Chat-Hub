import { Router } from "express";
import { storage } from "../storage";
import { auth } from "../middleware/auth";
import { Reaction } from "@shared/schema";

const router = Router();

// ... existing routes ...

// Get reactions for a message
router.get("/:messageId/reactions", auth, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const reactions = await storage.getMessageReactions(messageId);
    res.json(reactions);
  } catch (error) {
    console.error("Error fetching reactions:", error);
    res.status(500).json({ error: "Failed to fetch reactions" });
  }
});

// Toggle a reaction on a message
router.post("/:messageId/reactions", auth, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const { emoji, name, action } = req.body;
    if (!emoji || !name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const userId = req.user.id;
    const reactions = await storage.toggleReaction(
      messageId,
      userId,
      emoji,
      name
    );

    // Emit the reaction update to all connected clients
    req.app.get("io").emit("message_reaction", {
      messageId,
      message: { reactions },
    });

    res.setHeader("Content-Type", "application/json");
    res.json({ reactions });
  } catch (error) {
    console.error("Error toggling reaction:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
});

export default router;
