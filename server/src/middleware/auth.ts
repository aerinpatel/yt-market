import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export const adminOnly = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key-change-in-prod") as any;

        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        
        if (!user || user.role !== 'ADMIN') {
            res.status(403).json({ error: "Forbidden. Admin access required." });
            return;
        }
        
        (req as any).user = user;
        next();

    } catch (error) {
        res.status(401).json({ error: "Invalid token" });
    }
};
