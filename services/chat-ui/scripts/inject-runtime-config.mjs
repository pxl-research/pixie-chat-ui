import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FALLBACK_API_BASE_URL = "http://localhost:8010";

function resolveApiBaseUrl() {
  const candidates = [
    process.env.API_BASE_URL,
    process.env.VITE_API_BASE_URL,
    FALLBACK_API_BASE_URL,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().replace(/\/$/, "");
    }
  }

  return FALLBACK_API_BASE_URL;
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const distDir = join(scriptDir, "..", "dist");
  const targetPath = join(distDir, "env-config.js");

  const normalizedBaseUrl = resolveApiBaseUrl();

  const payload = {
    API_BASE_URL: normalizedBaseUrl,
  };

  const content = `window.__ENV__ = Object.assign({}, window.__ENV__, ${JSON.stringify(payload, null, 2)});\n`;

  await mkdir(distDir, { recursive: true });
  await writeFile(targetPath, content, "utf8");

  console.log(`[runtime-config] Wrote env-config.js with API_BASE_URL=${normalizedBaseUrl}`);
}

main().catch((error) => {
  console.error("[runtime-config] Failed to write env-config.js", error);
  process.exit(1);
});
