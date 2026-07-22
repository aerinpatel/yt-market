export const calculateMomentumScore = (avgViewsLast3: number, avgViewsLast20: number): number => {
    const momentumRatio = avgViewsLast3 / Math.max(avgViewsLast20, 1);
    const momentumScore = Math.min(momentumRatio * 50, 100);
    return momentumScore;
};
