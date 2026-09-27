import fs from "fs";
import os from "os";
import path from "path";

// Imported first by every test file: a private, throwaway data folder and test settings, set
// before anything reads them. Never the real backend/data.
process.env.NODE_ENV = "test";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "flippilot-ads-test-"));
process.env.ADVERT_AI_REVIEW = "stub-ok";
process.env.ADMIN_TOKEN = "test-admin-token-that-is-long-enough-123";
process.env.GEOCODE_STUB = "LS1 1AA=53.797,-1.548;LS2 7HY=53.806,-1.555;M1 1AE=53.481,-2.237";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.RESEND_API_KEY;
delete process.env.PUBLIC_BASE_URL;
