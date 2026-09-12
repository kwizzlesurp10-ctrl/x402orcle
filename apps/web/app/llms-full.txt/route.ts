import { llmsFullTxt } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(llmsFullTxt(oracleEnv()), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "access-control-allow-origin": "*",
    },
  });
}
