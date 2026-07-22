export const calculateGrowthScore = (subsToday: number, subsYesterday: number, viewsToday: number, viewsYesterday: number): number => {
    const subGrowthRaw = subsYesterday > 0 ? ((subsToday - subsYesterday) / subsYesterday) * 100 : 0;
    const viewGrowthRaw = viewsYesterday > 0 ? ((viewsToday - viewsYesterday) / viewsYesterday) * 100 : 0;
    
    const subGrowth = Math.max(-100, Math.min(subGrowthRaw, 100));
    const viewGrowth = Math.max(-100, Math.min(viewGrowthRaw, 100));

    // Combine them
    const rawGrowthScore = (0.7 * viewGrowth) + (0.3 * subGrowth);
    // Convert -100..100 to 0..100 domain
    const growthScore = Math.max(0, (rawGrowthScore + 100) / 2);

    return Math.max(1, Math.min(growthScore, 100));
};
