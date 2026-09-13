interface PhotoAnalysis {
  condition?: "Excellent" | "Good" | "Fair" | "Poor";
  damage?: string;
  rust?: string;
  cleanliness?: string;
  valueImpact?: number;
}

interface EnhancementData {
  bestPhotoScore?: number;
}

interface BackgroundData {
  style?: "white" | "flipBlue" | "goldGlow";
}

interface AutoCleanData {
  cleanlinessScore?: number;
}

interface ThumbnailScore {
  uri: string;
  score: number;
}

export async function chooseBestThumbnail(
  photos: string[],
  analysis: PhotoAnalysis[],
  enhancement: EnhancementData[],
  background: BackgroundData[],
  autoClean: AutoCleanData[]
): Promise<ThumbnailScore> {
  return photos
    .map((uri: string, idx: number) => {
      const score =
        (analysis[idx]?.condition === "Excellent" ? 30 :
         analysis[idx]?.condition === "Good" ? 20 :
         analysis[idx]?.condition === "Fair" ? 10 : 0)
        +
        ((enhancement[idx]?.bestPhotoScore ?? 0) * 0.3)
        +
        (background[idx]?.style === "goldGlow" ? 20 :
         background[idx]?.style === "flipBlue" ? 10 : 5)
        +
        ((autoClean[idx]?.cleanlinessScore ?? 0) * 0.4);

      return { uri, score };
    })
    .sort((a: ThumbnailScore, b: ThumbnailScore) => b.score - a.score)[0];
}

