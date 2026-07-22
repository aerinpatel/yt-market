export const calculateEngagementScore = (totalInteractions: number, totalViewsLast20: number): number => {
    const rawEngagementRate = totalInteractions / Math.max(totalViewsLast20, 1);
    const engagementScore = Math.min(rawEngagementRate * 1000, 100);
    return engagementScore;
};
