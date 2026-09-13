export async function analyzePhoto(uri: string) {
  // Simulated AI analysis — replace with your backend later
  return {
    condition: ["Excellent", "Good", "Fair", "Poor"][Math.floor(Math.random() * 4)],
    damage: Math.random() > 0.7 ? "Minor scratches detected" : "No visible damage",
    rust: Math.random() > 0.85 ? "Rust spots detected" : "No rust",
    cleanliness: Math.random() > 0.5 ? "Clean" : "Needs cleaning",
    valueImpact: Math.floor(Math.random() * 300),
    summary: "Photo analyzed successfully. Condition and damage estimated.",
  };
}
