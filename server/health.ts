import { Request, Response } from "express";

export function registerHealthRoutes(app: any) {
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: {
        connected: true,
        url: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"),
      },
    });
  });
}
