import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User, WorkspaceMember, ChannelMember } from "./schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  VerifiedCallback,
} from "passport-jwt";

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
      email: string;
      password: string;
      displayName: string;
      status: string;
      avatarUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

const PostgresSessionStore = connectPg(session);

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePasswords = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export function generateToken(user: User): string {
  // Ensure avatarUrl is either a string or null, not undefined
  const sanitizedUser = {
    ...user,
    avatarUrl: user.avatarUrl || null,
  };

  return jwt.sign(
    {
      id: sanitizedUser.id,
      username: sanitizedUser.username,
      email: sanitizedUser.email,
      displayName: sanitizedUser.displayName,
      status: sanitizedUser.status,
      avatarUrl: sanitizedUser.avatarUrl,
      createdAt: sanitizedUser.createdAt,
      updatedAt: sanitizedUser.updatedAt,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): {
  id: number;
  username: string;
  email: string;
  displayName: string;
  status: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
} | null {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      email: string;
      displayName: string;
      status: string;
      avatarUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
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
    store: new PostgresSessionStore({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
  };

  app.use(session(sessionOptions));

  // Initialize passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure local strategy for username/password auth
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValid = await comparePasswords(password, user.password!);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Configure JWT strategy for JWT auth
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET,
      },
      async (payload: { id: number }, done: VerifiedCallback) => {
        try {
          const user = await storage.getUser(payload.id);
          if (!user) {
            return done(null, false);
          }
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );

  // Serialize user to the session
  passport.serializeUser((user: User, done) => {
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
      const { username, password, displayName, email } = req.body;
      console.log("Registration attempt:", { username, email, displayName });

      // Validate input
      if (!username || !password || !displayName || !email) {
        return res.status(400).json({
          success: false,
          message: "Username, password, display name, and email are required",
        });
      }

      // Check if user already exists by username or email
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log("Username already exists:", username);
        return res.status(400).json({
          success: false,
          message: "Username already exists",
        });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        console.log("Email already exists:", email);
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }

      // Hash the password
      const hashedPassword = await hashPassword(password);

      // Create the user
      console.log("Creating user with:", { username, email, displayName });
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        displayName,
        status: "online",
        avatarUrl: null, // Explicitly set to null
      });
      console.log("User created successfully:", user);

      // Ensure avatarUrl is properly set to null if undefined
      const sanitizedUser = {
        ...user,
        avatarUrl: user.avatarUrl || null,
      };

      // Log the user in
      req.login(sanitizedUser, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
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
            email: user.email,
            displayName: user.displayName,
            status: user.status,
            avatarUrl: user.avatarUrl,
          },
          token,
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
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
          .then((user: User | undefined) => {
            if (user) {
              req.user = user;
              return next();
            }
            res.status(401).json({ message: "Invalid token" });
          })
          .catch((err: Error) => {
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
  // Check session authentication
  if (req.isAuthenticated()) {
    return next();
  }

  // Check JWT authentication
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
      // Attach user info to request
      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        password: "", // Not needed for JWT auth
        displayName: decoded.displayName,
        status: decoded.status,
        avatarUrl: decoded.avatarUrl,
        createdAt: decoded.createdAt,
        updatedAt: decoded.updatedAt,
      };
      return next();
    }
  }

  res.status(401).json({ message: "Not authenticated" });
}

export const isWorkspaceMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const workspaceId = parseInt(req.params.workspaceId);
  if (!workspaceId) {
    return res.status(400).json({ message: "Invalid workspace ID" });
  }

  try {
    const isMember = await storage.isUserInWorkspace(
      req.user?.id || 0,
      workspaceId
    );
    if (!isMember) {
      return res.status(403).json({ message: "Not a workspace member" });
    }
    next();
  } catch (error) {
    console.error("Error checking workspace membership:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const isChannelMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const channelId = parseInt(req.params.channelId);
  if (!channelId) {
    return res.status(400).json({ message: "Invalid channel ID" });
  }

  try {
    const isMember = await storage.isUserInChannel(
      req.user?.id || 0,
      channelId
    );
    if (!isMember) {
      return res.status(403).json({ message: "Not a channel member" });
    }
    next();
  } catch (error) {
    console.error("Error checking channel membership:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const isDirectMessageParticipant = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const dmId = parseInt(req.params.dmId);
  if (isNaN(dmId)) {
    return res.status(400).json({ message: "Invalid direct message ID" });
  }

  const dm = await storage.getDirectMessage(dmId);
  if (!dm) {
    return res.status(404).json({ message: "Direct message not found" });
  }

  if (dm.user1Id !== req.user?.id && dm.user2Id !== req.user?.id) {
    return res.status(403).json({ message: "Not a participant" });
  }

  next();
};

export const isWorkspaceOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const workspaceId = parseInt(req.params.workspaceId);
  if (isNaN(workspaceId)) {
    return res.status(400).json({ message: "Invalid workspace ID" });
  }

  const workspace = await storage.getWorkspace(workspaceId);
  if (!workspace) {
    return res.status(404).json({ message: "Workspace not found" });
  }

  if (workspace.ownerId !== req.user?.id) {
    return res.status(403).json({ message: "Not the workspace owner" });
  }

  next();
};

// Create a seed user for testing
const seedUser: User = {
  id: 1,
  username: "demo",
  email: "demo@example.com",
  password: "demo",
  displayName: "Demo User",
  status: "online",
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
