export const calculateMarketDemand = (buyOrders: number, sellOrders: number): number => {
    const demandRatio = (buyOrders + 1) / (sellOrders + 1);
    const marketDemandScore = Math.max(0, Math.min(50 + (Math.log10(demandRatio) * 20), 100));
    return marketDemandScore;
};

export const calculateRiskPenalty = (daysSinceLastUpload: number): number => {
    if (daysSinceLastUpload > 180) return 50;
    if (daysSinceLastUpload > 60) return 20;
    if (daysSinceLastUpload > 30) return 5;
    return 0;
};

export const calculateHourlyDelta = (
    growthScore: number,
    engagementScore: number,
    momentumScore: number,
    marketDemandScore: number,
    riskPenalty: number,
    oldPrice: number
): number => {
    const noise = (Math.random() - 0.5) * 2.0;
    
    // Price Change = Growth*0.02 + Momentum*0.015 + Demand*0.03 - Risk*0.02 + Random
    // (We also include Engagement as it is 30% of their importance based on the earlier spec)
    const delta = 
        (growthScore * 0.02) + 
        (engagementScore * 0.01) + 
        (momentumScore * 0.015) + 
        (marketDemandScore * 0.03) - 
        (riskPenalty * 0.02) + 
        noise;
    
    return Math.max(1, oldPrice + delta);
};
