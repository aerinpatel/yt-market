import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { matchingEngine } from './lib/engine/MatchingEngine';

import { PrismaClient } from '@prisma/client';
import { OrderSide, OrderType, Order as EngineOrder } from './lib/engine/types';

const prisma = new PrismaClient();
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Initialize Next.js app instance
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

import { processTrades } from './lib/engine/reconciliation';

app.prepare().then(async () => {
  console.log('Hydrating In-Memory Matching Engine from Database...');
  try {
    const openOrders = await prisma.order.findMany({
      where: {
        status: { in: ['OPEN', 'PARTIAL'] }
      },
      orderBy: { createdAt: 'asc' } // Must load in chronological order to preserve FIFO priority!
    });

    let count = 0;
    for (const dbOrder of openOrders) {
      const engineOrder: EngineOrder = {
        id: dbOrder.id,
        userId: dbOrder.userId,
        creatorId: dbOrder.creatorId,
        side: dbOrder.side as OrderSide,
        type: dbOrder.type as OrderType,
        price: dbOrder.price ? Number(dbOrder.price) : null,
        quantity: Number(dbOrder.quantity),
        remainingQuantity: Number(dbOrder.remainingQuantity),
        isCreatorAction: dbOrder.isCreatorAction,
        createdAt: dbOrder.createdAt.getTime(),
      };
      
      // Load directly into the matching engine
      const { trades } = await matchingEngine.placeOrder(engineOrder);
      if (trades.length > 0) {
        await processTrades(trades, engineOrder.price);
      }
      count++;
    }
    console.log(`Successfully hydrated ${count} open orders into the engine!`);
  } catch (error) {
    console.error('Failed to hydrate matching engine:', error);
  }

  // Create native HTTP server
  const httpServer = createServer((req, res) => {
    try {
      handle(req, res);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Allow clients to subscribe to specific creator feeds
    socket.on('subscribe', async (creatorId: string) => {
      socket.join(`book:${creatorId}`);
      socket.join(`trades:${creatorId}`);
      console.log(`Socket ${socket.id} joined rooms for ${creatorId}`);
      
      // Instantly send current depth on subscribe
      const depth = await matchingEngine.getOrderBookSnapshot(creatorId);
      socket.emit('depth', depth);
    });

    // Allow user to subscribe to private account notifications (like STP alerts)
    socket.on('subscribe_user', (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`Socket ${socket.id} joined private room for user ${userId}`);
    });

    // Allow clients to subscribe to global market ticker feed (/market overview)
    socket.on('subscribe_market', () => {
      socket.join('global:tape');
      console.log(`Socket ${socket.id} joined global:tape`);
    });

    socket.on('unsubscribe_market', () => {
      socket.leave('global:tape');
    });

    socket.on('unsubscribe', (creatorId: string) => {
      socket.leave(`book:${creatorId}`);
      socket.leave(`trades:${creatorId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Creator channel name cache for low-overhead global broadcasts
  const channelNameCache = new Map<string, string>();

  // Listen to Matching Engine internal events and broadcast to Socket.IO rooms
  matchingEngine.on('trade', async (trade) => {
    // 1. Channel-specific room for the trading terminal
    io.to(`trades:${trade.creatorId}`).emit('trade', trade);

    // 2. Global market tape room for the /market overview page
    let channelName = channelNameCache.get(trade.creatorId);
    if (!channelName) {
      try {
        const c = await prisma.creator.findUnique({
          where: { id: trade.creatorId },
          select: { channelName: true }
        });
        channelName = c?.channelName || 'Creator';
        channelNameCache.set(trade.creatorId, channelName);
      } catch (err) {
        channelName = 'Creator';
      }
    }

    io.to('global:tape').emit('global_trade', {
      id: trade.id,
      creatorId: trade.creatorId,
      channelName,
      price: trade.price,
      quantity: trade.quantity,
      executedAt: trade.executedAt,
    });
  });

  matchingEngine.on('depth', ({ creatorId, snapshot }) => {
    io.to(`book:${creatorId}`).emit('depth', snapshot);
  });

  matchingEngine.on('stp_cancelled', ({ userId, creatorId, cancelledOrders }) => {
    io.to(`user:${userId}`).emit('stp_alert', {
      creatorId,
      count: cancelledOrders.length,
      message: `Self-Trade Prevention Notice: ${cancelledOrders.length} resting order(s) were cancelled & refunded to prevent self-matching.`
    });
  });

  // Start listening
  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port} (Custom WS Server)`);
    });
});
