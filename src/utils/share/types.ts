export type ShareFlipBase = {
  title: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  roi: number | null;
  confidence: number | null;
  origin?: string | null;
  description?: string | null;
  image?: string | null;
  flipScore?: number | null;
  isProFlip?: boolean;
};

export type ShareMode = "text" | "image" | "full" | "compact" | "csv";
