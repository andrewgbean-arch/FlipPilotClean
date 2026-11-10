/**
 * What the server's home page says about which build is running, so that a deploy can be checked from outside in seconds. Found 10 Nov 2026: a push that was not seen to restart the
 * live service (it normally does, for about a minute) could not be shown to be live at all, because nothing the server said told one build from another.
 *
 * `startedAt` is when this process started, so a restart after a push can be seen. `commit` is the short hash of the commit the service was built from: Render sets RENDER_GIT_COMMIT for a
 * service it builds from Git, and anywhere else (a laptop, a test) there is none and the field is simply left out. The repository is public, so a short hash tells nobody anything new.
 */
export function buildInfo(env: Record<string, string | undefined>, startedAt: string): { startedAt: string; commit?: string } {
  const full = (env.RENDER_GIT_COMMIT ?? "").trim();
  return /^[0-9a-f]{7,40}$/i.test(full) ? { startedAt, commit: full.slice(0, 7).toLowerCase() } : { startedAt };
}
