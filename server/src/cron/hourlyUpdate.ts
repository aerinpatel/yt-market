import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import * as youtubeService from '../services/youtube.service.js';
import { calculateGrowthScore } from '../algorithms/growth.js';
import { calculateEngagementScore } from '../algorithms/engagement.js';
import { calculateConsistencyScore } from '../algorithms/consistency.js';
import { calculateMomentumScore } from '../algorithms/momentum.js';
import { calculateMarketDemand, calculateRiskPenalty, calculateHourlyDelta } from '../algorithms/pricing.js';
import { calculateCreatorScore } from '../algorithms/creatorScore.js';
import { broadcastMessage } from '../services/websocket.service.js';

export const startHourlyUpdate = () => {
    cron.schedule('0 * * * *', async () => {
        try {
            console.log("Running Hourly Update...");
            // Only update channels that are approved and not paused
            const channels = await prisma.channel.findMany({
                where: { isApproved: true, isTradingPaused: false }
            });
            
            for (const channel of channels) {
                try {
                    const channelData = await youtubeService.getChannel(channel.handle);
                    if (!channelData || !channelData.statistics) continue;

                    const uploadsPlaylistId = channelData.contentDetails.relatedPlaylists.uploads;
                    const allVideos = await youtubeService.getVideos(uploadsPlaylistId, 50);
                    if (allVideos.length === 0) continue;

                    const videoIds = allVideos.map((v: any) => v.snippet.resourceId.videoId);
                    const statMap = await youtubeService.getVideoStats(videoIds);

                    const nowTime = Date.now();
                    const thirtyDaysAgo = nowTime - 30 * 24 * 60 * 60 * 1000;
                    
                    const last30Days = allVideos.filter((v: any) => new Date(v.snippet.publishedAt).getTime() >= thirtyDaysAgo);
                    const last3Videos = allVideos.slice(0, 3);
                    const last20Videos = allVideos.slice(0, 20);

                    const lastUploadDate = new Date(allVideos[0].snippet.publishedAt).getTime();
                    const daysSinceLastUpload = Math.floor((nowTime - lastUploadDate) / (1000 * 60 * 60 * 24));
                    const oldestVideoTime = new Date(allVideos[allVideos.length - 1].snippet.publishedAt).getTime();
                    const daysBetween = Math.max(1, (lastUploadDate - oldestVideoTime) / (1000 * 60 * 60 * 24));

                    const getAvgViews = (videoArray: any[]) => {
                        if (videoArray.length === 0) return 0;
                        const total = videoArray.reduce((sum, v) => sum + Number(statMap.get(v.snippet.resourceId.videoId)?.viewCount || 0), 0);
                        return total / videoArray.length;
                    };

                    const avgViewsLast3 = getAvgViews(last3Videos);
                    const avgViewsLast20 = getAvgViews(last20Videos);

                    let totalViewsLast20 = 0, totalLikesLast20 = 0, totalCommentsLast20 = 0;
                    last20Videos.forEach((v: any) => {
                        const st = statMap.get(v.snippet.resourceId.videoId);
                        if (st) {
                            totalViewsLast20 += Number(st.viewCount || 0);
                            totalLikesLast20 += Number(st.likeCount || 0);
                            totalCommentsLast20 += Number(st.commentCount || 0);
                        }
                    });

                    // Snapshot querying for Growth metric
                    const currentSubs = parseInt(channelData.statistics.subscriberCount) || channel.subscriberCount;
                    const currentViews = parseInt(channelData.statistics.viewCount) || channel.viewCount;

                    const oneDayAgo = new Date(nowTime - 24 * 60 * 60 * 1000);
                    const lastSnapshot = await prisma.channelSnapshot.findFirst({
                        where: { channelId: channel.id, createdAt: { lte: oneDayAgo } },
                        orderBy: { createdAt: 'desc' }
                    });

                    const subsYesterday = lastSnapshot?.subscriberCount || currentSubs;
                    const viewsYesterday = lastSnapshot?.viewCount || currentViews;

                    // Calculate Scores
                    const growthScore = calculateGrowthScore(currentSubs, subsYesterday, currentViews, viewsYesterday);
                    const engagementScore = calculateEngagementScore(totalLikesLast20 + totalCommentsLast20, totalViewsLast20);
                    const consistencyScore = calculateConsistencyScore(allVideos.length, daysBetween, last30Days.length);
                    const momentumScore = calculateMomentumScore(avgViewsLast3, avgViewsLast20);
                    
                    const oneHourAgo = new Date(nowTime - 60 * 60 * 1000);
                    const buyOrdersAgg = await prisma.trade.aggregate({
                        _sum: { shares: true },
                        where: { channelId: channel.id, type: 'BUY', createdAt: { gte: oneHourAgo } }
                    });
                    const sellOrdersAgg = await prisma.trade.aggregate({
                        _sum: { shares: true },
                        where: { channelId: channel.id, type: 'SELL', createdAt: { gte: oneHourAgo } }
                    });

                    const buyOrders = buyOrdersAgg._sum.shares || 0;
                    const sellOrders = sellOrdersAgg._sum.shares || 0;

                    const marketDemandScore = calculateMarketDemand(buyOrders, sellOrders);
                    const riskPenalty = calculateRiskPenalty(daysSinceLastUpload);

                    const newPrice = calculateHourlyDelta(
                        growthScore,
                        engagementScore,
                        momentumScore,
                        marketDemandScore,
                        riskPenalty,
                        channel.currentPrice
                    );
                    
                    const creatorScore = calculateCreatorScore(
                        growthScore,
                        engagementScore,
                        consistencyScore,
                        momentumScore,
                        marketDemandScore,
                        riskPenalty
                    );

                    // Transactional Update
                    const [updatedChannel] = await prisma.$transaction([
                        prisma.channel.update({
                            where: { id: channel.id },
                            data: {
                                currentPrice: newPrice,
                                creatorScore,
                                growthScore,
                                engagementScore,
                                consistencyScore,
                                momentumScore,
                                marketDemandScore,
                                subscriberCount: currentSubs,
                                viewCount: currentViews,
                                videoCount: parseInt(channelData.statistics.videoCount) || channel.videoCount
                            }
                        }),
                        prisma.channelSnapshot.create({
                            data: {
                                channelId: channel.id,
                                subscriberCount: currentSubs,
                                viewCount: currentViews,
                                creatorScore,
                                stockPrice: newPrice
                            }
                        }),
                        prisma.priceHistory.create({
                            data: {
                                channelId: channel.id,
                                price: newPrice,
                                creatorScore
                            }
                        })
                    ]);

                    // Generate Notifications if stock shifted > 5%
                    const shiftPct = ((newPrice - channel.currentPrice) / channel.currentPrice) * 100;
                    if (Math.abs(shiftPct) >= 5) {
                        const message = `${channel.name} ${shiftPct > 0 ? 'gained' : 'fell'} ${Math.abs(Math.round(shiftPct))}% in the last hour!`;
                        
                        const watchersAndHolders = await prisma.user.findMany({
                            where: {
                                OR: [
                                    { watchlistChannels: { some: { id: channel.id } } },
                                    { portfolios: { some: { channelId: channel.id, sharesOwned: { gt: 0 } } } }
                                ]
                            }
                        });

                        const notificationsParams = watchersAndHolders.map(u => ({
                            userId: u.id,
                            message
                        }));

                        if (notificationsParams.length > 0) {
                            await prisma.notification.createMany({ data: notificationsParams });
                        }
                    }

                    // Broadcast down WS
                    broadcastMessage({ type: 'price-update', channelId: channel.id, price: newPrice });

                } catch (err: any) {
                    console.error(`Failed to recalibrate channel ${channel.id}:`, err.message);
                }
            }
        } catch (error) {
            console.error("Hourly Update Error:", error);
        }
    });
};
