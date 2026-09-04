import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { landingHtml } from "@x402orcle/oracle-brain";
import { loadEnv } from "@x402orcle/oracle-brain";
import { createOracleApp } from "./app.js";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  const alt = resolve(process.cwd(), "../../.env");
  for (const p of [path, alt]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadDotEnv();

const env = loadEnv({
  ...process.env,
  X402_PAY_TO:
    process.env.X402_PAY_TO ||
    process.env.X402_PAY_TO_ADDRESS ||
    "0xAB745e5F576667037696e78ba7dA28E193E4423D",
  DEMO_MODE: process.env.DEMO_MODE ?? "true",
});

if (env.sellerLeakWarning) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event: "seller_leak",
      message: "EVM_PRIVATE_KEY is set in this process. Unset it on public hosts.",
    }),
  );
}

const app = createOracleApp(env);
app.get("/", (_req, res) => {
  res.type("html").send(landingHtml(env));
});

app.listen(env.port, env.host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "listening",
      health: `${env.publicBaseUrl}/health`,
      mcp: `${env.publicBaseUrl}/mcp`,
      ask: `${env.publicBaseUrl}/api/consult/oracle_ask`,
      mode: env.demoMode ? "demo" : "live",
      payTo: env.payTo,
    }),
  );
});
