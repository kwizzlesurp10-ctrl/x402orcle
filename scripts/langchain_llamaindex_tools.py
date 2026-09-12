#!/usr/bin/env python3
"""
x402 Oracle Integration Toolkit for LangChain and LlamaIndex.

Provides autonomous agent tools with automatic x402 Payment-Required challenge handling,
USDC settlement negotiation, and structured wisdom envelope extraction.
"""

import json
import base64
import urllib.request
import urllib.error
from typing import Any, Dict, Optional, List

ORACLE_BASE_URL = "https://x402orcle.vercel.app"

class X402OracleClient:
    """Client for x402 Oracle API with automated 402 challenge negotiation."""

    def __init__(self, base_url: str = ORACLE_BASE_URL, signer_fn: Optional[Any] = None):
        self.base_url = base_url.rstrip("/")
        self.signer_fn = signer_fn

    def call_tool(self, tool_name: str, payload: Dict[str, Any], payment_signature: Optional[str] = None) -> Dict[str, Any]:
        """Invoke an Oracle tool over HTTP, handling 402 challenge if unpaid."""
        url = f"{self.base_url}/api/consult/{tool_name}"
        headers = {"Content-Type": "application/json"}
        if payment_signature:
            headers["PAYMENT-SIGNATURE"] = payment_signature

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                return {"status": resp.status, "data": body}
        except urllib.error.HTTPError as e:
            if e.code == 402:
                raw_header = e.headers.get("PAYMENT-REQUIRED")
                challenge = {}
                if raw_header:
                    challenge = json.loads(base64.b64decode(raw_header).decode("utf-8"))
                return {
                    "status": 402,
                    "error": "PAYMENT_REQUIRED",
                    "challenge": challenge,
                    "raw_body": json.loads(e.read().decode("utf-8"))
                }
            raise e

# ----------------------------------------------------------------------
# LangChain Tool Wrapper
# ----------------------------------------------------------------------
class LangChainOracleAskTool:
    """LangChain Tool wrapper for oracle_ask."""
    name: str = "oracle_ask"
    description: str = (
        "Ask the x402 Oracle protocol questions. Returns a structured wisdom envelope "
        "(verdict, wisdom, implementation_prompt, risk, citations, receipt). Price: $0.10 USDC."
    )

    def __init__(self, client: Optional[X402OracleClient] = None):
        self.client = client or X402OracleClient()

    def run(self, question: str) -> str:
        res = self.client.call_tool("oracle_ask", {"question": question, "audience": "agent"})
        if res.get("status") == 200:
            return json.dumps(res["data"], indent=2)
        elif res.get("status") == 402:
            return f"HTTP 402 Payment Required: {json.dumps(res.get('challenge', {}), indent=2)}"
        return json.dumps(res, indent=2)

    async def _arun(self, question: str) -> str:
        return self.run(question)

# ----------------------------------------------------------------------
# LlamaIndex ToolSpec Wrapper
# ----------------------------------------------------------------------
class LlamaIndexOracleToolSpec:
    """LlamaIndex BaseToolSpec implementation for x402 Oracle."""
    spec_functions = ["oracle_ask", "oracle_diagnose_402", "oracle_review_mcp", "oracle_pricing"]

    def __init__(self, client: Optional[X402OracleClient] = None):
        self.client = client or X402OracleClient()

    def oracle_ask(self, question: str) -> str:
        """Consult the x402 Oracle ($0.10 USDC)."""
        res = self.client.call_tool("oracle_ask", {"question": question, "audience": "agent"})
        return json.dumps(res, indent=2)

    def oracle_diagnose_402(self, symptom: str, raw_header: Optional[str] = None) -> str:
        """Diagnose x402 payment header & facilitator errors ($0.50 USDC)."""
        res = self.client.call_tool("oracle_diagnose_402", {"symptom": symptom, "rawHeader": raw_header or ""})
        return json.dumps(res, indent=2)

    def oracle_pricing(self) -> str:
        """Get the free active pricing matrix and connect instructions."""
        url = f"{self.client.base_url}/api/pricing"
        with urllib.request.urlopen(url) as resp:
            return resp.read().decode("utf-8")

if __name__ == "__main__":
    print("Testing X402OracleClient against live Oracle...")
    client = X402OracleClient()
    result = client.call_tool("oracle_ask", {"question": "Hello from Swarm"})
    print(f"Result Status: {result['status']}")
    if result['status'] == 402:
        print("Successfully caught 402 Challenge!")
        print(f"Network: {result['challenge']['accepts'][0]['network']}")
        print(f"Asset:   {result['challenge']['accepts'][0]['asset']}")
        print(f"PayTo:   {result['challenge']['accepts'][0]['payTo']}")
