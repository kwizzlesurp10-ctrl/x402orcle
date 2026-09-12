/**
 * x402 Oracle TypeScript Integration Toolkit for LangChain, AI SDK, and Autonomous Swarms.
 */

export interface OracleWisdomEnvelope {
  verdict: string;
  wisdom: string;
  implementation_prompt: string;
  risk: string;
  citations: string[];
  receipt: {
    tool: string;
    priceUsd: number;
    network: string;
    payTo: string;
    mode: "live" | "demo";
    settlementId: string;
    payer?: string;
    paidAt: string;
  };
}

export interface X402Challenge {
  x402Version: 2;
  error: string;
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
  }>;
  resource: {
    url: string;
    description: string;
    serviceName: string;
    tags: string[];
  };
}

export class X402OracleClient {
  constructor(public baseUrl: string = "https://x402orcle.vercel.app") {}

  async consultTool(
    toolName: string,
    input: Record<string, unknown>,
    paymentSignature?: string
  ): Promise<{ status: number; data?: OracleWisdomEnvelope; challenge?: X402Challenge }> {
    const url = `${this.baseUrl}/api/consult/${toolName}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (paymentSignature) {
      headers["PAYMENT-SIGNATURE"] = paymentSignature;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });

    if (res.status === 200) {
      const data = (await res.json()) as OracleWisdomEnvelope;
      return { status: 200, data };
    }

    if (res.status === 402) {
      const reqHeader = res.headers.get("payment-required");
      let challenge: X402Challenge | undefined;
      if (reqHeader) {
        challenge = JSON.parse(Buffer.from(reqHeader, "base64").toString("utf8"));
      }
      return { status: 402, challenge };
    }

    throw new Error(`Oracle returned HTTP ${res.status}: ${await res.text()}`);
  }
}
