import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import jwt from "jsonwebtoken";

export const getChannels = async (req: Request, res: Response): Promise<void> => {
    try {
        const channels = await prisma.channel.findMany({
            where: { isApproved: true },
            orderBy: { currentPrice: 'desc' }
        });
        res.json(channels);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch channels" });
    }
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channelId } = req.params;
        const history = await prisma.priceHistory.findMany({
            where: { channelId: channelId as string },
            orderBy: { createdAt: 'asc' }
        });
        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
};

export const getPortfolio = async (req: Request, res: Response): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key-change-in-prod") as any;

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            include: {
                portfolios: {
                    include: { channel: true }
                }
            }
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        res.json({
            walletBalance: user.walletBalance,
            portfolios: user.portfolios
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getWatchlist = async (req: Request, res: Response): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key-change-in-prod") as any;

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            include: {
                watchlistChannels: true
            }
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        res.json(user.watchlistChannels);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const toggleWatchlist = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channelId } = req.body;
        if (!channelId) {
            res.status(400).json({ error: "channelId is required" });
            return;
        }
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key-change-in-prod") as any;
        
        let channel = await prisma.channel.findFirst({ 
            where: { 
                OR: [
                    { id: channelId },
                    { handle: channelId }
                ]
            } 
        });
        if (!channel || (!channel.isApproved)) {
            // Require the channel to be IPO'd & Approved first
            res.status(404).json({ error: "Channel not found or not approved by Admin."});
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            include: { watchlistChannels: true }
        });
        
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        const isWatching = user.watchlistChannels.some(c => c.id === channel.id);
        
        if (isWatching) {
            await prisma.user.update({
                where: { id: decoded.id },
                data: { watchlistChannels: { disconnect: { id: channel.id } } }
            });
            res.json({ message: "Removed from watchlist", added: false });
        } else {
            await prisma.user.update({
                where: { id: decoded.id },
                data: { watchlistChannels: { connect: { id: channel.id } } }
            });
            res.json({ message: "Added to watchlist", added: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const search = async (req: Request, res: Response): Promise<void> => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            res.status(400).json({ error: "Query parameter 'q' is required" });
            return;
        }

        const { searchChannels } = await import("../services/youtube.service.js");
        const results = await searchChannels(q);
        res.json(results);
    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({ error: "Failed to search YouTube channels" });
    }
};

export const getLeaderboards = async (req: Request, res: Response): Promise<void> => {
    try {
        const channels = await prisma.channel.findMany({
            where: { isApproved: true },
            include: {
                snapshots: {
                    orderBy: { createdAt: 'desc' },
                    take: 24, // get recent snapshots to find yesterday's
                }
            }
        });

        // Map and calculate 24h percentage changes
        const decorated = channels.map(ch => {
            const yesterdaySnapshot = ch.snapshots.find(s => {
                const ageHours = (Date.now() - s.createdAt.getTime()) / (1000 * 60 * 60);
                return ageHours >= 23 && ageHours <= 25;
            }) || ch.snapshots[ch.snapshots.length - 1]; // fallback to oldest if within 24h

            const yesterdayPrice = yesterdaySnapshot ? yesterdaySnapshot.stockPrice : (ch.ipoPrice || ch.currentPrice);
            const percentageChange = yesterdayPrice > 0 
                ? ((ch.currentPrice - yesterdayPrice) / yesterdayPrice) * 100 
                : 0;

            const marketCap = ch.currentPrice * (ch.ipoPrice || 10000); 

            return {
                ...ch,
                percentageChange,
                marketCap
            };
        });

        const topGainers = [...decorated].sort((a, b) => b.percentageChange - a.percentageChange).slice(0, 5);
        const topLosers = [...decorated].sort((a, b) => a.percentageChange - b.percentageChange).slice(0, 5);
        const highestMarketCap = [...decorated].sort((a, b) => b.marketCap - a.marketCap).slice(0, 5);

        const volumes = await prisma.trade.groupBy({
            by: ['channelId'],
            _sum: { shares: true },
            orderBy: { _sum: { shares: 'desc' } },
            take: 5
        });

        const mostTraded = volumes.map(v => {
            const c = decorated.find(ch => ch.id === v.channelId);
            return {
                channel: c,
                volume: v._sum.shares || 0
            };
        }).filter(v => v.channel);

        res.json({
            topGainers,
            topLosers,
            highestMarketCap,
            mostTraded
        });

    } catch (error) {
        console.error("Leaderboards Error:", error);
        res.status(500).json({ error: "Failed to fetch leaderboards" });
    }
};

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key-change-in-prod") as any;

        const notifications = await prisma.notification.findMany({
            where: { userId: decoded.id },
            orderBy: { createdAt: 'desc' },
            take: 30
        });

        res.json(notifications);
    } catch (error) {
        console.error("Get Notifications Error:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
};
