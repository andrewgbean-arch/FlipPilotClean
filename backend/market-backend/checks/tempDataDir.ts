// Imported FIRST by a check that runs code which writes to the data folder (the cost log, for one): it points DATA_DIR at a throwaway
// folder, so a check can never touch the real data. Imports run in the order they are written, so this has to come before the rest.
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "flippilot-check-"));
