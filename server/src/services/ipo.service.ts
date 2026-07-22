import { prisma } from '../lib/prisma.js';
import * as youtubeService from './youtube.service.js';
import { calculateGrowthScore } from '../algorithms/growth.js';
import { calculateEngagementScore } from '../algorithms/engagement.js';
import { calculateConsistencyScore } from '../algorithms/consistency.js';
import { calculateMomentumScore } from '../algorithms/momentum.js';
import { calculateMarketDemand, calculateRiskPenalty } from '../algorithms/pricing.js';
import { calculateCreatorScore } from '../algorithms/creatorScore.js';

export const processCreatorIPO = async (handle: string) => {
    // 1. Fetch channel info
    const channelData = await youtubeService.getChannel(handle);
    const channelId = channelData.id;
    const name = channelData.snippet.title;
    const logo = channelData.snippet.thumbnails?.default?.url || null;
    const uploadsPlaylistId = channelData.contentDetails.relatedPlaylists.uploads;

    const subscriberCount = Number(channelData.statistics.subscriberCount || 0);
    const viewCount = Number(channelData.statistics.viewCount || 0);
    const videoCount = Number(channelData.statistics.videoCount || 0);

    // 2. Fetch latest 50 uploads
    const allVideos = await youtubeService.getVideos(uploadsPlaylistId, 50);
    if (allVideos.length === 0) {
        throw new Error("No videos found for this channel.");
    }

    // 3. Fetch stats for videos in bulk
    const videoIds = allVideos.map((v: any) => v.snippet.resourceId.videoId);
    const statMap = await youtubeService.getVideoStats(videoIds);

    // 4. Time Buckets (Phase 4 Data Processing)
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const last7Days = allVideos.filter((v: any) => new Date(v.snippet.publishedAt).getTime() >= sevenDaysAgo);
    const prev7Days = allVideos.filter((v: any) => {
        const t = new Date(v.snippet.publishedAt).getTime();
        return t >= fourteenDaysAgo && t < sevenDaysAgo;
    });
    const last30Days = allVideos.filter((v: any) => new Date(v.snippet.publishedAt).getTime() >= thirtyDaysAgo);
    
    const last3Videos = allVideos.slice(0, 3);
    const last20Videos = allVideos.slice(0, 20);

    const lastUploadDate = new Date(allVideos[0].snippet.publishedAt).getTime();
    const daysSinceLastUpload = Math.floor((now - lastUploadDate) / (1000 * 60 * 60 * 24));

    const oldestVideoTime = new Date(allVideos[allVideos.length - 1].snippet.publishedAt).getTime();
    const newestVideoTime = lastUploadDate;
    const daysBetween = Math.max(1, (newestVideoTime - oldestVideoTime) / (1000 * 60 * 60 * 24));

    // 5. Aggregations
    const getAvgViews = (videoArray: any[]) => {
        if (videoArray.length === 0) return 0;
        const total = videoArray.reduce((sum, v) => sum + Number(statMap.get(v.snippet.resourceId.videoId)?.viewCount || 0), 0);
        return total / videoArray.length;
    };

    const avgViewsLast7Days = getAvgViews(last7Days);
    const avgViewsPrev7Days = getAvgViews(prev7Days);
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
    const totalInteractions = totalLikesLast20 + totalCommentsLast20;

    // 6. Run Algorithm
    const growthScore = calculateGrowthScore(subscriberCount, subscriberCount, viewCount, viewCount);
    const engagementScore = calculateEngagementScore(totalInteractions, totalViewsLast20);
    const consistencyScore = calculateConsistencyScore(allVideos.length, daysBetween, last30Days.length);
    const momentumScore = calculateMomentumScore(avgViewsLast3, avgViewsLast20);
    const marketDemandScore = calculateMarketDemand(0, 0); // Neutral initial demand
    const riskPenalty = calculateRiskPenalty(daysSinceLastUpload);

    const creatorScore = calculateCreatorScore(
        growthScore,
        engagementScore,
        consistencyScore,
        momentumScore,
        marketDemandScore,
        riskPenalty
    );

    // IPO Price mapped 1:1 with Creator Score for now
    const ipoPrice = creatorScore;
    const currentPrice = ipoPrice;

    // 7. Store in Database
    const channel = await prisma.channel.upsert({
        where: { handle },
        update: {
            name,
            logo,
            currentPrice,
            ipoPrice,
            creatorScore,
            growthScore,
            engagementScore,
            consistencyScore,
            momentumScore,
            marketDemandScore,
            subscriberCount,
            viewCount,
            videoCount
        },
        create: {
            id: channelId,
            handle,
            name,
            logo,
            currentPrice,
            ipoPrice,
            creatorScore,
            growthScore,
            engagementScore,
            consistencyScore,
            momentumScore,
            marketDemandScore,
            subscriberCount,
            viewCount,
            videoCount
        }
    });

    return channel;
};
