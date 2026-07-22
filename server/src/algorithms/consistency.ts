export const calculateConsistencyScore = (allVideosLength: number, daysBetween: number, last30DaysLength: number): number => {
    let dynamicTargetUploadsPerMonth = Math.max(1, (allVideosLength / Math.max(daysBetween, 1)) * 30);
    const consistencyScore = Math.min((last30DaysLength / dynamicTargetUploadsPerMonth) * 100, 100);
    return consistencyScore;
};
