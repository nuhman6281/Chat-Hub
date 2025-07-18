import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const JWT_SECRET =
  process.env.JWT_SECRET || "chat-app-super-secret-key-for-development";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "chat-app-session-secret-key";

// Define the User type for Express
declare global {
  namespace Express {
    // Use an interface that matches our User type from schema
    interface User {
      id: number;
      username: string;
      password: string;
      displayName: string;
      status: string;
      avatarUrl?: string | null;
      publicKey?: string | null;
    }
  }
}

const PostgresSessionStore = connectPg(session);

export async function comparePasswords(
  supplied: string,
  stored: string
): Promise<boolean> {
  return await bcrypt.compare(supplied, stored);
}

export function generateToken(user: User): string {
  // Ensure avatarUrl is either a string or null, not undefined
  const sanitizedUser = {
    ...user,
    avatarUrl: user.avatarUrl || null,
  };

  return jwt.sign(
    { id: sanitizedUser.id, username: sanitizedUser.username },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(
  token: string
): { id: number; username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; username: string };
  } catch (error) {
    return null;
  }
}

export function setupAuth(app: Express) {
  // Set up session middleware
  const sessionOptions: session.SessionOptions = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    store: storage.sessionStore,
  };

  app.use(session(sessionOptions));

  // Initialize passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure local strategy for username/password auth
  passport.use(
    new LocalStrategy(async (username: string, password: string, done: any) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Serialize user to the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password, displayName } = req.body;

      // Validate input
      if (!username || !password || !displayName) {
        return res.status(400).json({
          success: false,
          message: "Username, password, and display name are required",
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create the user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        displayName,
        status: "online",
        avatarUrl: null, // Explicitly set to null
      });

      // Create a default workspace for the new user
      const workspace = await storage.createWorkspace({
        name: `${displayName}'s Workspace`,
        ownerId: user.id,
        iconText: displayName.charAt(0).toUpperCase(),
        iconColor: "#3b82f6",
      });

      // Add user as admin to their workspace
      await storage.addWorkspaceMember({
        workspaceId: workspace.id,
        userId: user.id,
        role: "admin",
      });

      // Create a general channel in the workspace
      const channel = await storage.createChannel({
        name: "general",
        workspaceId: workspace.id,
        createdBy: user.id,
        isPrivate: false,
      });

      // Add user to the general channel
      await storage.addChannelMember({
        channelId: channel.id,
        userId: user.id,
      });

      // Ensure avatarUrl is properly set to null if undefined
      const sanitizedUser = {
        ...user,
        avatarUrl: user.avatarUrl || null,
      };

      // Log the user in
      req.login(sanitizedUser, (err) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Error logging in after registration",
          });
        }

        // Generate a JWT token
        const token = generateToken(sanitizedUser);

        // Return success
        return res.status(201).json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            status: user.status,
            avatarUrl: user.avatarUrl,
          },
          token,
        });
      });
    } catch (error) {
      // Filter out unrelated WebSocket errors from browser extensions
      if (
        error &&
        typeof error === "object" &&
        "target" in error &&
        error.target &&
        typeof error.target === "object" &&
        "_url" in error.target &&
        error.target._url &&
        typeof error.target._url === "string" &&
        error.target._url.includes("/v2")
      ) {
        console.log(
          "Ignoring unrelated WebSocket error from browser extension"
        );
        return;
      }

      console.error("Registration error:", error);
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error registering user",
      });
    }
  });

  // Login endpoint
  app.post(
    "/api/auth/login",
    (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate(
        "local",
        (err: any, user: Express.User, info: { message?: string }) => {
          if (err) {
            return next(err);
          }
          if (!user) {
            return res.status(401).json({
              success: false,
              message: info?.message || "Invalid credentials",
            });
          }

          // Ensure avatarUrl is properly set to either string or null
          const sanitizedUser = {
            ...user,
            avatarUrl: user.avatarUrl || null,
          };

          req.login(sanitizedUser, (err) => {
            if (err) {
              return next(err);
            }

            // Generate a JWT token
            const token = generateToken(sanitizedUser);

            // Update user status to online
            storage.updateUserStatus(user.id, "online");

            return res.json({
              success: true,
              user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                status: user.status,
                avatarUrl: user.avatarUrl,
              },
              token,
            });
          });
        }
      )(req, res, next);
    }
  );

  // Logout endpoint
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    // Update user status to offline if authenticated
    if (req.isAuthenticated() && req.user) {
      await storage.updateUserStatus(req.user.id, "offline");
    }

    req.logout((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error logging out",
        });
      }
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    });
  });

  // Get current user endpoint
  app.get("/api/auth/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Return user data without sensitive information
    res.json({
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      status: req.user.status,
      avatarUrl: req.user.avatarUrl,
    });
  });

  // Middleware for protecting routes
  app.use("/api/*", (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for the auth routes and demo routes in development
    if (
      req.path.startsWith("/api/auth/") ||
      (process.env.NODE_ENV === "development" &&
        req.path.startsWith("/api/demo/"))
    ) {
      return next();
    }

    // Check if user is authenticated via session
    if (req.isAuthenticated()) {
      return next();
    }

    // Check for JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      if (decoded) {
        // Get the user from the database
        storage
          .getUser(decoded.id)
          .then((user) => {
            if (user) {
              req.user = user;
              return next();
            }
            res.status(401).json({ message: "Invalid token" });
          })
          .catch((err) => {
            console.error("Token validation error:", err);
            res.status(500).json({ message: "Server error" });
          });
        return;
      }
    }

    // If we get here, the user is not authenticated
    res.status(401).json({ message: "Not authenticated" });
  });
}

// Helper middleware for routes that require authentication
export function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({ message: "Not authenticated" });
}
