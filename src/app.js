import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./routes.js";
import { setupAuth } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json());

// Prevent stale frontend assets after deployment/pull.
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const { requireAuth } = setupAuth(app);

app.use(requireAuth);
app.use(express.static(path.join(__dirname, "../public"), { index: false }));
app.use("/", routes);

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
