import type { EmotionState } from "../../api/types";
import { emotionColor, topEmotions } from "../../lib/emotions";
import { humanize } from "../../lib/format";

export function MoodBadge({ mood, small }: { mood: string; small?: boolean }) {
  if (!mood) return null;
  return (
    <span className={small ? "mood-badge small" : "mood-badge"} title={`Mood: ${mood}`}>
      <span className="swatch round" style={{ background: emotionColor(mood) }} aria-hidden="true" />
      {humanize(mood)}
    </span>
  );
}

/** Mood + top three emotions, updated from every ChatResponse. */
export function EmotionStrip({ emotion, mood }: { emotion: EmotionState | undefined; mood: string | undefined }) {
  if (!emotion && !mood) return null;
  const top = topEmotions(emotion, 3);
  return (
    <div className="emotion-strip" aria-label="Companion's current mood" role="group">
      {mood && <MoodBadge mood={mood} />}
      <ul className="emotion-mini" aria-label="Strongest emotions">
        {top.map((e) => (
          <li key={e.name} title={`${e.label}: ${Math.round(e.value)} / 100`}>
            <span className="emotion-mini-label">{e.label}</span>
            <span className="emotion-mini-track" aria-hidden="true">
              <span className="emotion-mini-fill" style={{ width: `${Math.max(3, Math.min(100, e.value))}%`, background: e.color }} />
            </span>
            <span className="sr-only">{Math.round(e.value)} out of 100</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
