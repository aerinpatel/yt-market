import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-in-prod";

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, username, password } = req.body;
        if (!email || !username || !password) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] }
        });

        if (existingUser) {
            res.status(400).json({ error: "User already exists" });
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await prisma.user.create({
            data: {
                email,
                username,
                password: hashedPassword,
                salt,
                walletBalance: 10000.00
            }
        });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
        res.json({ token, user: { id: user.id, username: user.username, walletBalance: user.walletBalance, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            res.status(400).json({ error: "Invalid credentials" });
            return;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            res.status(400).json({ error: "Invalid credentials" });
            return;
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
        res.json({ token, user: { id: user.id, username: user.username, walletBalance: user.walletBalance, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const becomeCreator = async (req: Request, res: Response): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        const user = await prisma.user.update({
            where: { id: decoded.id },
            data: { role: 'CREATOR' }
        });

        const newToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
        res.json({ 
            token: newToken, 
            user: { id: user.id, username: user.username, walletBalance: user.walletBalance, role: user.role } 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update role to CREATOR" });
    }
};

