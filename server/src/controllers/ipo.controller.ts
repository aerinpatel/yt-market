import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import jwt from "jsonwebtoken";
import { processCreatorIPO } from "../services/ipo.service.js";

export const ipo = async (req: Request, res: Response): Promise<void> => {
    try {
        const { handle } = req.body;
        if (!handle || typeof handle !== 'string') {
            res.status(400).json({ error: "Invalid or missing creator handle" });
            return;
        }
        
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key-change-in-prod") as any;

        const existingChannel = await prisma.channel.findUnique({ where: { handle } });
        if (existingChannel) {
            res.status(400).json({ error: "Channel already IPO'd" });
            return;
        }

        const channel = await processCreatorIPO(handle);

        await prisma.$transaction(async (tx) => {
            // Update the channel with ownerId and ensure isApproved is false for admin approval
            await tx.channel.update({
                where: { handle },
                data: { 
                    ownerId: decoded.id,
                    isApproved: false 
                }
            });

            await tx.priceHistory.create({
                data: {
                    channelId: channel.id,
                    price: channel.ipoPrice,
                    creatorScore: channel.creatorScore
                }
            });

            // Initial shares reserved for creator
            await tx.portfolio.create({
                data: {
                    userId: decoded.id,
                    channelId: channel.id,
                    sharesOwned: 100000,
                    averageBuyPrice: 0 // IPO grant
                }
            });

            // Notify all admins about the new IPO launch application
            const admins = await tx.user.findMany({ where: { role: 'ADMIN' } });
            if (admins.length > 0) {
                await tx.notification.createMany({
                    data: admins.map(a => ({
                        userId: a.id,
                        message: `New Creator IPO Application: '${channel.name}' (@${channel.handle}) requires verification and approval.`
                    }))
                });
            }
        });

        res.json({ message: "IPO submitted for Admin approval", handle, initialPrice: channel.ipoPrice, isApproved: false });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message || "IPO process failed" });
    }
};

export const getCreatorChannel = async (req: Request, res: Response): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key-change-in-prod") as any;

        const channel = await prisma.channel.findFirst({
            where: { ownerId: decoded.id }
        });

        res.json({ channel });
    } catch (error) {
        console.error("Get Creator Channel Error:", error);
        res.status(500).json({ error: "Failed to fetch creator channel" });
    }
};

