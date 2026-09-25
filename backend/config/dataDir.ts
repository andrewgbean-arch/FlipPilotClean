import dotenv from "dotenv";
import fs from "fs";
import path from "path";

/**
 * Where every data file lives: listings, accounts, credits, messages, photos and the rest.
 *
 *   DATA_DIR=/some/path   put it there (on a host, mount the persistent disk at this path)
 *   (not set)             backend/data, the same place whether the server is run from the source
 *                         (npm run dev) or from the compiled code in dist (npm start)
 *
 * Without a persistent disk a host wipes these files at every redeploy, so on a real server set DATA_DIR
 * to the disk. The server says where it is using at start-up, and the launch check warns if it is not set.
 *
 * This is read the moment it is first imported, which is before server.ts loads the .env file, so it loads
 * the .env itself (loading it twice is harmless).
 */
dotenv.config();

const backendRoot = (() => {
  const here = path.resolve(__dirname, "..");
  // In compiled code this file is backend/dist/config, so the backend folder is one level further up.
  return path.basename(here) === "dist" ? path.resolve(here, "..") : here;
})();

const configured = process.env.DATA_DIR?.trim();

export const DATA_DIR = configured ? path.resolve(configured) : path.join(backendRoot, "data");
export const DATA_DIR_IS_CONFIGURED = Boolean(configured);

// Several stores write without making the folder first, so a brand-new disk must not be missing it.
fs.mkdirSync(DATA_DIR, { recursive: true });

/** A file inside the data folder. */
export const dataPath = (...parts: string[]): string => path.join(DATA_DIR, ...parts);
