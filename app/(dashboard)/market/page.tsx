import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import MarketClient, { MarketCreator, MarketTrade, MarketHolding } from './MarketClient';

export default async function MarketPage(props: {
  searchParams: Promise<{ sort?: string; search?: string }>;
}) {
  const searchParams = await props.searchParams;
  const sort = searchParams.sort || 'recent';
  const search = searchParams.search || '';

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  let user: { email: string; walletBalance: string } | null = null;
  let holdingsList: MarketHolding[] = [];
  let totalValue = 0;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          holdings: {
            where: { quantity: { gt: 0 } },
            include: {
              creator: {
                include: {
                  trades: { orderBy: [{ executedAt: 'desc' }, { id: 'desc' }], take: 1 }
                }
              }
            }
          }
        }
      });

      if (dbUser) {
        user = {
          email: dbUser.email,
          walletBalance: dbUser.walletBalance.toString(),
        };

        holdingsList = dbUser.holdings.map((h: any) => {
          const latestTrade = h.creator.trades[0];
          const currentPrice = latestTrade ? latestTrade.price.toNumber() : (h.creator.ipoPrice?.toNumber() || 0);
          const value = currentPrice * Number(h.quantity);
          const cost = Number(h.avgBuyPrice) * Number(h.quantity);

          totalValue += value;
          const pnl = value - cost;
          const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

          return {
            id: h.id,
            creatorId: h.creatorId,
            name: h.creator.channelName,
            ticker: h.creator.channelName.substring(0, 4).toUpperCase(),
            quantity: Number(h.quantity),
            value,
            pnlPercent,
          };
        });
      }
    }
  }

  const whereClause = search ? {
    channelName: {
      contains: search,
      mode: 'insensitive' as const
    }
  } : {};

  const creators = await prisma.creator.findMany({
    where: whereClause,
    include: {
      scores: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      },
      trades: {
        orderBy: [
          { executedAt: 'desc' },
          { id: 'desc' }
        ],
        take: 1
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Recent 8 Trades across all creators for the right sidebar
  const recentGlobalTrades = await prisma.trade.findMany({
    take: 8,
    orderBy: [
      { executedAt: 'desc' },
      { id: 'desc' }
    ],
    include: {
      creator: { select: { channelName: true } }
    }
  });

  const serializedCreators: MarketCreator[] = creators.map(creator => {
    const latestTrade = creator.trades[0];
    const currentPrice = latestTrade ? latestTrade.price.toNumber() : (creator.ipoPrice?.toNumber() || 0);
    const ipoPrice = creator.ipoPrice?.toNumber() || 1;
    const marketCap = currentPrice * Number(creator.totalShares);
    const changePercent = ((currentPrice - ipoPrice) / ipoPrice) * 100;
    const latestScore = creator.scores[0]?.computedScore;

    return {
      id: creator.id,
      channelName: creator.channelName,
      ticker: creator.channelName.substring(0, 4).toUpperCase(),
      currentPrice,
      ipoPrice,
      totalShares: creator.totalShares.toString(),
      floatShares: creator.floatShares.toString(),
      marketCap,
      changePercent,
      latestScore,
      createdAt: creator.createdAt.toISOString(),
    };
  });

  const serializedTrades: MarketTrade[] = recentGlobalTrades.map(t => ({
    id: t.id,
    creator: { channelName: t.creator.channelName },
    quantity: Number(t.quantity),
    price: t.price.toNumber(),
    executedAt: t.executedAt.toISOString(),
  }));

  return (
    <MarketClient
      initialCreators={serializedCreators}
      initialTrades={serializedTrades}
      user={user}
      initialHoldings={holdingsList}
      initialTotalValue={totalValue}
      sort={sort}
    />
  );
}
