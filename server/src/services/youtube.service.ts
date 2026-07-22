import axios from 'axios';

const getBaseUrl = () => 'https://www.googleapis.com/youtube/v3';
const getApiKey = () => process.env.YOUTUBE_API;

export const getChannel = async (idOrHandle: string) => {
    const param = idOrHandle.startsWith('UC') ? `id=${idOrHandle}` : `forHandle=${idOrHandle}`;
    const res = await axios.get(
        `${getBaseUrl()}/channels?part=snippet,contentDetails,statistics&${param}&key=${getApiKey()}`
    );
    if (!res.data.items || res.data.items.length === 0) {
        throw new Error("Channel not found");
    }
    return res.data.items[0];
};

export const getUploads = async (channelId: string) => {
    const res = await axios.get(
        `${getBaseUrl()}/channels?part=contentDetails&id=${channelId}&key=${getApiKey()}`
    );
    if (!res.data.items || res.data.items.length === 0) {
        throw new Error("Channel not found");
    }
    return res.data.items[0].contentDetails.relatedPlaylists.uploads;
};

export const getVideos = async (playlistId: string, maxResults: number = 50) => {
    const res = await axios.get(
        `${getBaseUrl()}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${getApiKey()}`
    );
    return res.data.items || [];
};

export const getVideoStats = async (videoIds: string[]) => {
    // API allows up to 50 IDs per request
    const ids = videoIds.slice(0, 50).join(',');
    const res = await axios.get(
        `${getBaseUrl()}/videos?part=statistics&id=${ids}&key=${getApiKey()}`
    );
    
    const statMap = new Map();
    if (res.data.items) {
        res.data.items.forEach((item: any) => {
            statMap.set(item.id, item.statistics);
        });
    }
    return statMap;
};

export const getSubscribers = async (channelId: string) => {
    const res = await axios.get(
        `${getBaseUrl()}/channels?part=statistics&id=${channelId}&key=${getApiKey()}`
    );
    return res.data.items?.[0]?.statistics?.subscriberCount || 0;
};

export const getViews = async (channelId: string) => {
    const res = await axios.get(
        `${getBaseUrl()}/channels?part=statistics&id=${channelId}&key=${getApiKey()}`
    );
    return res.data.items?.[0]?.statistics?.viewCount || 0;
};

export const searchChannels = async (query: string) => {
    const res = await axios.get(
        `${getBaseUrl()}/search?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(query)}&key=${getApiKey()}`
    );
    const items = res.data.items || [];
    return items.map((item: any) => ({
        channelId: item.snippet.channelId,
        title: item.snippet.channelTitle,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.default?.url
    }));
};
