import type { Health } from "../api/types";

/** Human-readable problems with the local models, e.g. "run `ollama pull llama3.1:8b`". */
export function modelProblems(h: Health | undefined): { text: string; command?: string }[] {
  if (!h?.ollama) return [];
  const o = h.ollama;
  if (!o.available) return [{ text: "Ollama isn't reachable, so Genesis can't think or remember. Start it with", command: "ollama serve" }];
  const out: { text: string; command?: string }[] = [];
  if (o.chat_model_installed === false) out.push({ text: `Chat model "${o.chat_model}" isn't installed. Run`, command: `ollama pull ${o.chat_model}` });
  if (o.embed_model_installed === false)
    out.push({ text: `Embedding model "${o.embed_model}" isn't installed (needed for memory search). Run`, command: `ollama pull ${o.embed_model}` });
  return out;
}
