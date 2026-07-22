export const calculateCreatorScore = (
    growthScore: number,
    engagementScore: number,
    consistencyScore: number,
    momentumScore: number,
    marketDemandScore: number,
    riskPenalty: number
): number => {
    let finalCreatorScore = 
        (0.35 * growthScore) + 
        (0.30 * engagementScore) + 
        (0.15 * consistencyScore) + 
        (0.10 * momentumScore) + 
        (0.10 * marketDemandScore) - 
        riskPenalty;

    return Math.max(1, Math.min(finalCreatorScore, 100));
};
