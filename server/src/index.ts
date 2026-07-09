import express from "express";
import WebSocket, { WebSocketServer } from 'ws';
import axios from 'axios';
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const wss = new WebSocketServer({ port: 8080 });

async function calculateCreatorScore(channelName:string) {
    try {
        const channel = channelName;
        const API_KEY = process.env.YOUTUBE_API;

        console.log(`Fetching data for ${channel}...`);

        // 1. Fetch Channel Details & Total Subs
        const channelRes = await axios.get(
            `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&forHandle=${channel}&key=${API_KEY}`
        );

        const channelData = channelRes.data.items[0];
        const UploadsID = channelData.contentDetails.relatedPlaylists.uploads;
        const totalSubscribers = Number(channelData.statistics.subscriberCount);

        // 2. Fetch Recent Uploads (Up to 50)
        const uploadsRes = await axios.get(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${UploadsID}&maxResults=50&key=${API_KEY}`
        );
        const allVideos = uploadsRes.data.items;

        if (allVideos.length === 0) {
            console.log("No videos found.");
            return;
        }

        // 3. Fetch Video Statistics in bulk
        const ids = allVideos.map((video: any) => video.snippet.resourceId.videoId);
        const statsRes = await axios.get(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(",")}&key=${API_KEY}`
        );

        const statMap = new Map();
        statsRes.data.items.forEach((item: any) => {
            statMap.set(item.id, item.statistics);
        });

        // 4. Time Buckets & Slices
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

        // 5. Helpers
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

        // ==========================================
        // DYNAMIC ALGORITHM IMPLEMENTATION
        // ==========================================

        // 1. Growth Score (35%)
        const viewGrowthRaw = ((avgViewsLast7Days - avgViewsPrev7Days) / Math.max(avgViewsPrev7Days, 1)) * 100;
        const viewGrowth = Math.max(-100, Math.min(viewGrowthRaw, 100));

        // DYNAMIC SUBS: Since we lack a DB right now, we estimate sub growth closely mirrors view momentum.
        // If views doubled, subs likely grew rapidly. If views are flat, subs are flat.
        const estimatedSubGrowthRaw = viewGrowthRaw * 0.2; 
        const subGrowth = Math.max(-100, Math.min(estimatedSubGrowthRaw, 100));

        const rawGrowthScore = (0.7 * viewGrowth) + (0.3 * subGrowth);
        const growthScore = Math.max(0, (rawGrowthScore + 100) / 2);

        // 2. Engagement Score (30%)
        const totalInteractions = totalLikesLast20 + totalCommentsLast20;
        const rawEngagementRate = totalInteractions / Math.max(totalViewsLast20, 1);
        let engagementScore = rawEngagementRate * 1000;
        engagementScore = Math.min(engagementScore, 100);

        // 3. Consistency Score (15%) - NOW FULLY DYNAMIC
        // Calculate the span of days across all returned videos
        const oldestVideoTime = new Date(allVideos[allVideos.length - 1].snippet.publishedAt).getTime();
        const newestVideoTime = new Date(allVideos[0].snippet.publishedAt).getTime();
        
        let daysBetween = (newestVideoTime - oldestVideoTime) / (1000 * 60 * 60 * 24);
        daysBetween = Math.max(1, daysBetween); // Prevent divide by zero if they only have 1 video
        
        // Calculate their historical monthly average (e.g., 50 videos / 150 days * 30 = 10 videos a month)
        let dynamicTargetUploadsPerMonth = (allVideos.length / daysBetween) * 30;
        
        // Set a minimum expectation of 1 video per month so dead channels aren't rewarded
        dynamicTargetUploadsPerMonth = Math.max(1, dynamicTargetUploadsPerMonth);

        let consistencyScore = (last30Days.length / dynamicTargetUploadsPerMonth) * 100;
        consistencyScore = Math.min(consistencyScore, 100);

        // 4. Momentum Score (10%)
        const momentumRatio = avgViewsLast3 / Math.max(avgViewsLast20, 1);
        let momentumScore = momentumRatio * 50;
        momentumScore = Math.min(momentumScore, 100);

        // 5. Market Demand (10%) - NOW FULLY DYNAMIC (Simulated)
        // Until you hook up Prisma to read actual user buys/sells, we will simulate 
        // market demand based directly on the channel's current momentum. 
        // A trending channel (ratio > 1) gets more simulated buys.
        const simulatedBuyOrders = momentumRatio * 100; 
        const simulatedSellOrders = 100 / Math.max(momentumRatio, 0.1); 
        
        const demandRatio = (simulatedBuyOrders + 1) / (simulatedSellOrders + 1);
        let marketDemandScore = 50 + (Math.log10(demandRatio) * 20);
        marketDemandScore = Math.max(0, Math.min(marketDemandScore, 100));

        // 6. Risk Penalty
        let riskPenalty = 0;
        if (daysSinceLastUpload > 180) riskPenalty = 50;
        else if (daysSinceLastUpload > 60) riskPenalty = 20;
        else if (daysSinceLastUpload > 30) riskPenalty = 5;

        // ==========================================
        // FINAL CALCULATIONS
        // ==========================================

        let finalCreatorScore = 
            (0.35 * growthScore) + 
            (0.30 * engagementScore) + 
            (0.15 * consistencyScore) + 
            (0.10 * momentumScore) + 
            (0.10 * marketDemandScore) - 
            riskPenalty;

        finalCreatorScore = Math.max(1, Math.min(finalCreatorScore, 100));

        // IPO / Current Price (Base value modifier)
        const currentStockPrice = finalCreatorScore * 1.5;

        console.log({
            channel,
            dynamicTargetPerMonth: dynamicTargetUploadsPerMonth.toFixed(2),
            metrics: {
                growthScore: growthScore.toFixed(2),
                engagementScore: engagementScore.toFixed(2),
                consistencyScore: consistencyScore.toFixed(2),
                momentumScore: momentumScore.toFixed(2),
                marketDemandScore: marketDemandScore.toFixed(2),
                riskPenalty
            },
            finalCreatorScore: finalCreatorScore.toFixed(2),
            calculatedPrice: `$${currentStockPrice.toFixed(2)}`
        });

    } catch (error) {
        console.error("Error fetching or calculating data:", error);
    }
}

calculateCreatorScore("@Srijan06");

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});

// const channels:Array<string> = ["MrBeast","BigBangTheory","Friends","Manware","NeetCode"];
// const data:Array<DataType> = [];

// function startToFeedData(){
//   channels.forEach(async (channel) => {
//     const res = await axios.get(`https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${channel}&key=${process.env.YOUTUBE_API}`);

//     data.push({name:channel,views:Number(res.data.items[0].statistics.viewCount),subscriber:Number(res.data.items[0].statistics.subscriberCount),videos:Number(res.data.items[0].statistics.videoCount)});
//   })
    
// }

// async function feedData(){
//   channels.forEach(async (channel) => {
//     const res = await axios.get(
//     `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${channel}&key=${process.env.YOUTUBE_API}`
//   );
//   data.forEach((ele) => {
//       if(ele.name == channel){
//         ele.views = Number(res.data.items[0].statistics.viewCount);
//         ele.subscriber = Number(res.data.items[0].statistics.subscriberCount);
//         ele.videos = Number(res.data.items[0].statistics.videoCount);
//       }
//     });
//   // console.log(process.env.)
//   console.log("-------------------------------------");
//   })
// }
// function broadcastData() {
//   wss.clients.forEach((client:WebSocket) => {
//     if (client.readyState === WebSocket.OPEN) {
//       client.send(JSON.stringify(data));
//     }
//   });
// }
// startToFeedData();
// setInterval(async () => {
//   await feedData();
//   broadcastData();
//   console.log(data);
// }, 10000);




// app.listen(3000, () => {
//   console.log("Server running on port 3000");
// });