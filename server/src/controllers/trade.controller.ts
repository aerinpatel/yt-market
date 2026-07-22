import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import jwt from "jsonwebtoken";
import { executeTrade } from "../services/trade.service.js";
import { broadcastMessage } from "../services/websocket.service.js";

export const trade = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channelId, type, amount } = req.body;
        
        if (amount <= 0 || (type !== 'BUY' && type !== 'SELL')) {
            res.status(400).json({ error: "Invalid trade parameters" });
            return;
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key-change-in-prod") as any;
        const userId = decoded.id;

        const newPrice = await executeTrade(userId, channelId, type, amount);
        
        broadcastMessage({ type: "volume-update", channelId, tradeType: type, shares: amount });
        broadcastMessage({ type: "price-update", channelId, price: newPrice });

        res.json({ message: "Trade successful", newPrice });
    } catch (error: any) {
        console.error(error);
        res.status(400).json({ error: error.message || "Trade failed" });
    }
};
