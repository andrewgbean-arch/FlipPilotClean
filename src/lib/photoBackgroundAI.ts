export async function removeBackground(uri: string) {
  // Simulated background removal — replace with your backend later
  return {
    cleanedUri: uri, // backend will return a new transparent PNG or cleaned JPG
    removed: true,
    style: ["white", "flipBlue", "goldGlow"][Math.floor(Math.random() * 3)],
    summary: "Background removed successfully.",
  };
}
