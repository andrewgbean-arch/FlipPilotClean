/**
 * Makes a failure inside an async route handler an ordinary error reply, not a crash.
 *
 * Express 4 ignores the promise an async handler returns. If the handler throws (a service was down, a file
 * could not be written), that rejection is "unhandled", and on current Node an unhandled rejection ends the
 * whole process, taking every other person's in-flight request with it. So:
 *
 *  1. every route is patched so a rejected promise goes to the normal error handler in server.ts (a 500 for
 *     that one request, and nothing else is affected);
 *  2. as a last resort, a rejection nothing caught is logged instead of ending the server.
 *
 * Errors thrown SYNCHRONOUSLY are still caught by Express itself, and a genuine uncaught exception still ends
 * the process (its state can't be trusted): the host restarts it.
 *
 * Import this before anything registers routes.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Layer = require("express/lib/router/layer");

Layer.prototype.handle_request = function handleRequest(req: any, res: any, next: (err?: unknown) => void) {
  const fn = this.handle;
  // An error-handling function (four arguments) is only for errors.
  if (fn.length > 3) return next();
  try {
    const returned = fn(req, res, next);
    if (returned && typeof returned.catch === "function") returned.catch(next);
  } catch (err) {
    next(err);
  }
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (the server kept running):", reason instanceof Error ? reason.stack ?? reason.message : reason);
});
