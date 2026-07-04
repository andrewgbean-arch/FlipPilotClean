export const formatMoney = (n: number | null | undefined) =>
  n == null ? "-" : "£" + Number(n).toFixed(2);

export const formatROI = (roi: number | null) =>
  roi == null ? "-" : `${roi}%`;

export const proFlipBadge = (isPro: boolean, score?: number | null) =>
  isPro ? `🏆 PRO FLIP • Score ${score ?? 0}/100\n` : "";
