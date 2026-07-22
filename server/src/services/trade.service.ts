import { prisma } from "../lib/prisma.js";

export const executeTrade = async (userId: string, channelId: string, type: 'BUY' | 'SELL', amount: number) => {
    return await prisma.$transaction(async (tx) => {
        const channel = await tx.channel.findUnique({ where: { id: channelId } });
        if (!channel) throw new Error("Channel not found");
        if (!channel.isApproved) throw new Error("Channel is not approved for trading.");
        if (channel.isTradingPaused) throw new Error("Trading is currently paused for this creator.");

        const currentPrice = channel.currentPrice;
        const LIQUIDITY_DEPTH = 10000;

        let totalCost = 0;
        let newPrice = currentPrice;
        let averagePrice = currentPrice;

        if (type === 'BUY') {
            totalCost = currentPrice * LIQUIDITY_DEPTH * (Math.exp(amount / LIQUIDITY_DEPTH) - 1);
            newPrice = currentPrice * Math.exp(amount / LIQUIDITY_DEPTH);
            averagePrice = totalCost / amount;
        } else {
            totalCost = currentPrice * LIQUIDITY_DEPTH * (1 - Math.exp(-amount / LIQUIDITY_DEPTH));
            newPrice = currentPrice * Math.exp(-amount / LIQUIDITY_DEPTH);
            averagePrice = totalCost / amount;
        }

        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("User not found");

        if (type === 'BUY') {
            if (user.walletBalance < totalCost) throw new Error("Insufficient funds for trade slippage");

            await tx.user.update({
                where: { id: userId },
                data: { walletBalance: { decrement: totalCost } }
            });

            await tx.portfolio.upsert({
                where: { userId_channelId: { userId, channelId } },
                create: { userId, channelId, sharesOwned: amount, averageBuyPrice: averagePrice },
                update: { sharesOwned: { increment: amount } }
            });
        } else if (type === 'SELL') {
            const portfolio = await tx.portfolio.findUnique({
                where: { userId_channelId: { userId, channelId } }
            });

            if (!portfolio || portfolio.sharesOwned < amount) {
                throw new Error("Insufficient shares");
            }

            await tx.user.update({
                where: { id: userId },
                data: { walletBalance: { increment: totalCost } }
            });

            await tx.portfolio.update({
                where: { userId_channelId: { userId, channelId } },
                data: { sharesOwned: { decrement: amount } }
            });
        }

        // Update channel price in the DB
        await tx.channel.update({
            where: { id: channelId },
            data: { currentPrice: newPrice }
        });

        // Record the new price in history
        await tx.priceHistory.create({
            data: {
                channelId,
                price: newPrice,
                creatorScore: channel.creatorScore
            }
        });
        
        // Phase 16 Milestone Notification
        const updatedPortfolio = await tx.portfolio.findUnique({
            where: { userId_channelId: { userId, channelId } }
        });
        if (updatedPortfolio && type === 'BUY') {
            const oldShares = updatedPortfolio.sharesOwned - amount;
            if ((oldShares * currentPrice < 5000) && (updatedPortfolio.sharesOwned * newPrice >= 5000)) {
                await tx.notification.create({
                    data: {
                        userId,
                        message: `Your holdings in ${channel.name} just crossed $5,000 in value!`
                    }
                });
            }
        }

        await tx.trade.create({
            data: {
                userId,
                channelId,
                type,
                shares: amount,
                price: averagePrice
            }
        });
        
        return newPrice;
    });
};
