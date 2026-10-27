import path from "node:path";
import { config } from "dotenv";

// Tests always use .env.test and never the developer's .env.
config({ path: path.resolve(__dirname, "../../.env.test"), override: true, quiet: true });
