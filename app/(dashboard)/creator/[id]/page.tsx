import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import TradingTerminalClient from './TradingTerminalClient';

export default async function CreatorTradingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const creator = await prisma.creator.findUnique({
    where: { id },
    include: {
      user: true,
      scores: {
        orderBy: { recordedAt: 'desc' },
        take: 5
      },
      trades: {
        orderBy: [
          { executedAt: 'desc' },
          { id: 'desc' }
        ],
        take: 50
      }
    }
  });

  if (!creator) {
    notFound();
  }

  const latestTrade = creator.trades[0];
  const currentPrice = latestTrade ? latestTrade.price.toNumber() : (creator.ipoPrice?.toNumber() || 0);

  // Serializable data for client
  const serializedCreator = {
    id: creator.id,
    userId: creator.userId,
    channelName: creator.channelName,
    youtubeChannelId: creator.youtubeChannelId,
    ticker: creator.channelName.substring(0, 4).toUpperCase(),
    currentPrice: currentPrice,
    ipoPrice: creator.ipoPrice?.toNumber() || currentPrice,
    ipoStatus: creator.ipoStatus,
    totalShares: creator.totalShares.toString(),
    floatShares: creator.floatShares.toString(),
    ownerShares: creator.ownerShares.toString(),
    listedAt: creator.listedAt ? creator.listedAt.toISOString() : creator.createdAt.toISOString(),
    scores: creator.scores.map(s => ({
      id: s.id,
      subscribers: s.subscribers.toString(),
      totalViews: s.totalViews.toString(),
      videoCount: s.videoCount,
      uploadConsistency: s.uploadConsistency,
      computedScore: s.computedScore,
      recordedAt: s.recordedAt.toISOString(),
    })),
  };

  const serializedTrades = creator.trades.map(t => ({
    id: t.id,
    price: t.price.toNumber(),
    quantity: Number(t.quantity),
    executedAt: t.executedAt.getTime(),
  }));

  return <TradingTerminalClient creator={serializedCreator} initialTrades={serializedTrades} />;
}
