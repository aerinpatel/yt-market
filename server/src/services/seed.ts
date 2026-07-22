import { prisma } from "../lib/prisma.js";
import { processCreatorIPO } from "./ipo.service.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

const MAIN_CHANNELS = [
    "@mkbhd",
    "@mrbeast",
    "@pewdiepie",
    "@LinusTechTips",
    "@veritasium",
    "@smartereveryday",
    "@tomscott",
    "@kurzgesagt",
    "@vsauce",
    "@markiplier"
];

export const seedAdmin = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || "aerinpatel9@gmail.com";
        const adminPassword = process.env.ADMIN_PASSWORD || "shivampapa";
        
        const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (!existingAdmin) {
            const salt = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            
            await prisma.user.create({
                data: {
                    email: adminEmail,
                    username: "admin",
                    password: hashedPassword,
                    salt: salt,
                    role: 'ADMIN',
                    walletBalance: 100000.00
                }
            });
            console.log(`Seeded Admin User: ${adminEmail}`);
        } else if (existingAdmin.role !== 'ADMIN') {
            await prisma.user.update({
                where: { email: adminEmail },
                data: { role: 'ADMIN' }
            });
            console.log(`Updated existing user ${adminEmail} to ADMIN.`);
        }
    } catch (e) {
        console.error("Failed to seed admin:", e);
    }
};

export const seedMainChannels = async () => {
    try {
        console.log("Checking main watchlist channels...");
        for (const handle of MAIN_CHANNELS) {
            const existing = await prisma.channel.findUnique({ where: { handle } });
            if (!existing) {
                console.log(`Seeding main channel: ${handle}`);
                try {
                    const channel = await processCreatorIPO(handle);
                    
                    // Approve seed channels manually
                    await prisma.channel.update({
                        where: { id: channel.id },
                        data: { isApproved: true }
                    });
                    
                    await prisma.priceHistory.create({
                        data: {
                            channelId: channel.id,
                            price: channel.ipoPrice,
                            creatorScore: channel.creatorScore
                        }
                    });
                    
                    console.log(`Successfully seeded ${handle}`);
                } catch (e: any) {
                    console.error(`Failed to seed ${handle}: ${e.message}`);
                }
            } else if (!existing.isApproved) {
                await prisma.channel.update({
                    where: { id: existing.id },
                    data: { isApproved: true }
                });
            }
        }
        console.log("Finished seeding main channels.");
    } catch (e) {
        console.error("Error during seedMainChannels:", e);
    }
};
