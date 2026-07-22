import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export const approveChannel = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const channel = await prisma.channel.update({
            where: { id },
            data: { isApproved: true }
        });
        res.json({ message: "Channel approved successfully", channel });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to approve channel" });
    }
};

export const togglePauseChannel = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const channel = await prisma.channel.findUnique({ where: { id } });
        if (!channel) return res.status(404).json({ error: "Channel not found" });

        const updated = await prisma.channel.update({
            where: { id },
            data: { isTradingPaused: !channel.isTradingPaused }
        });
        res.json({ message: `Trading ${updated.isTradingPaused ? 'paused' : 'resumed'}`, channel: updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to toggle pause" });
    }
};

export const deleteChannel = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await prisma.channel.delete({
            where: { id }
        });
        res.json({ message: "Channel deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete channel" });
    }
};

export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                walletBalance: true,
                createdAt: true,
                _count: {
                    select: { trades: true, portfolios: true }
                }
            }
        });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
};

export const getTrades = async (req: Request, res: Response) => {
    try {
        const trades = await prisma.trade.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { username: true } },
                channel: { select: { name: true } }
            }
        });
        res.json(trades);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch trades" });
    }
};

export const getPendingChannels = async (req: Request, res: Response) => {
    try {
        const channels = await prisma.channel.findMany({
            where: { isApproved: false }
        });
        res.json(channels);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch pending channels" });
    }
};
