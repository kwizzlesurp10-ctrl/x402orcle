#!/usr/bin/env node
/**
 * x402 Oracle Multi-Registry Validation & Cataloging Engine
 * 
 * Verifies discovery routes, audits CORS headers, decodes HTTP 402 challenges,
 * performs live Coinbase CDP preflight validation (25 rules), and generates catalog submissions.
 */

const TARGET = process.argv.includes('--target') 
  ? process.argv[process.argv.indexOf('--target') + 1] 
  : (process.env.ORACLE_URL || 'https://x402orcle.vercel.app');

const JSON_OUTPUT = process.argv.includes('--json');
const SKIP_CDP = process.argv.includes('--skip-cdp');

const DISCOVERY_SURFACES = [
  { path: '/', label: 'Landing Web UI', expect: 'text/html' },
  { path: '/.well-known/x402', label: 'x402 / AgentCash Catalog', expect: 'application/json' },
  { path: '/.well-known/agent-card.json', label: 'OpenAgents / A2A Card', expect: 'application/json' },
  { path: '/.well-known/agents.json', label: 'A2A Federation Index', expect: 'application/json' },
  { path: '/.well-known/mcp.json', label: 'Smithery / MCP Manifest', expect: 'application/json' },
  { path: '/.well-known/funding.json', label: 'Cashier & PayTo Rail', expect: 'application/json' },
  { path: '/llms.txt', label: 'LLM Crawler Guide', expect: 'text/plain' },
  { path: '/agents.txt', label: 'Agent Permission Robots', expect: 'text/plain' },
  { path: '/openapi.json', label: 'OpenAPI 3.1 + x-payment', expect: 'application/json' },
  { path: '/api/health', label: 'Health & State Probe', expect: 'application/json' },
  { path: '/api/pricing', label: 'Active Rate Matrix', expect: 'application/json' }
];

const PAID_TOOLS = [
  { name: 'oracle_ask', priceUsd: 0.1, sample: { question: 'Validate x402 challenge format', audience: 'agent' } },
  { name: 'oracle_diagnose_402', priceUsd: 0.5, sample: { symptom: '401 FACILITATOR_AUTH_REQUIRED' } },
  { name: 'oracle_review_mcp', priceUsd: 3.0, sample: { mcpUrl: 'https://example.com/mcp' } },
  { name: 'oracle_bazaar_rewrite', priceUsd: 1.5, sample: { serviceName: 'Test Service', description: 'Sample' } },
  { name: 'complete_oracle_task', priceUsd: 10.0, sample: { taskDescription: 'Verify Base mainnet settlement' } }
];

async function probeSurface(surface) {
  const url = `${TARGET}${surface.path}`;
  try {
    const res = await fetch(url);
    const corsOrigin = res.headers.get('access-control-allow-origin') || '(none)';
    const corsMethods = res.headers.get('access-control-allow-methods') || '(none)';
    const corsExpose = res.headers.get('access-control-expose-headers') || '(none)';
    const contentType = res.headers.get('content-type') || 'unknown';
    const isOk = res.ok;

    return {
      path: surface.path,
      label: surface.label,
      status: res.status,
      ok: isOk,
      contentType: contentType.split(';')[0],
      cors: { origin: corsOrigin, methods: corsMethods, expose: corsExpose }
    };
  } catch (err) {
    return {
      path: surface.path,
      label: surface.label,
      status: 0,
      ok: false,
      error: err.message,
      cors: {}
    };
  }
}

async function probe402Challenge(tool) {
  const url = `${TARGET}/api/consult/${tool.name}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tool.sample)
    });

    const is402 = res.status === 402;
    const reqHeader = res.headers.get('payment-required');
    let decoded = null;
    let decodeError = null;

    if (reqHeader) {
      try {
        decoded = JSON.parse(Buffer.from(reqHeader, 'base64').toString('utf8'));
      } catch (e) {
        decodeError = e.message;
      }
    }

    return {
      tool: tool.name,
      priceUsd: tool.priceUsd,
      url,
      status: res.status,
      is402,
      hasHeader: Boolean(reqHeader),
      decoded,
      decodeError
    };
  } catch (err) {
    return {
      tool: tool.name,
      priceUsd: tool.priceUsd,
      url,
      status: 0,
      is402: false,
      error: err.message
    };
  }
}

async function validateWithCDP(toolName) {
  const resourceUrl = `${TARGET}/api/consult/${toolName}`;
  try {
    const res = await fetch('https://api.cdp.coinbase.com/platform/v2/x402/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource: resourceUrl,
        method: 'POST'
      })
    });
    const json = await res.json();
    return {
      tool: toolName,
      valid: Boolean(json.valid),
      statusCode: json.statusCode,
      passedChecks: Array.isArray(json.preflight) ? json.preflight.filter(c => c.passed).length : 0,
      totalChecks: Array.isArray(json.preflight) ? json.preflight.length : 0,
      outcome: json.simulation?.outcome || 'unknown',
      details: json
    };
  } catch (err) {
    return {
      tool: toolName,
      valid: false,
      error: err.message
    };
  }
}

async function main() {
  const startTime = Date.now();

  if (!JSON_OUTPUT) {
    console.log(`\n======================================================================`);
    console.log(`🌟 x402 Oracle Multi-Registry Validator & Cataloging Suite`);
    console.log(`🎯 Target Host: ${TARGET}`);
    console.log(`======================================================================\n`);
  }

  // 1. Audit Discovery Surfaces
  if (!JSON_OUTPUT) console.log(`🔍 [1/3] Auditing Discovery Surfaces & CORS Headers...`);
  const surfaceResults = [];
  for (const s of DISCOVERY_SURFACES) {
    const res = await probeSurface(s);
    surfaceResults.push(res);
    if (!JSON_OUTPUT) {
      const statusTag = res.ok ? `✅ [${res.status}]` : `❌ [${res.status || 'ERR'}]`;
      const corsTag = res.cors.origin === '*' ? `CORS: *` : `CORS: ${res.cors.origin || 'none'}`;
      console.log(`  ${statusTag} ${s.path.padEnd(32)} | ${s.label.padEnd(26)} | ${corsTag}`);
    }
  }

  // 2. Audit HTTP 402 Challenge Payloads
  if (!JSON_OUTPUT) console.log(`\n💳 [2/3] Probing x402 Challenge Payloads & Extensions...`);
  const challengeResults = [];
  for (const t of PAID_TOOLS) {
    const res = await probe402Challenge(t);
    challengeResults.push(res);
    if (!JSON_OUTPUT) {
      if (res.is402 && res.decoded) {
        const accept = res.decoded.accepts?.[0] || {};
        const amountUsd = accept.amount ? (Number(accept.amount) / 1e6).toFixed(2) : 'N/A';
        console.log(`  ✅ [402] ${t.name.padEnd(24)} | $${t.priceUsd.toFixed(2)} USD (${accept.amount} atomic) | Net: ${accept.network} | PayTo: ${accept.payTo?.slice(0, 10)}...`);
      } else {
        console.log(`  ❌ [FAIL] ${t.name.padEnd(24)} | Expected 402 + base64 PAYMENT-REQUIRED`);
      }
    }
  }

  // 3. Official Coinbase CDP Preflight Validation
  const cdpResults = [];
  if (!SKIP_CDP) {
    if (!JSON_OUTPUT) console.log(`\n🏛️  [3/3] Executing Live Coinbase CDP Facilitator Preflight Validation...`);
    for (const t of PAID_TOOLS) {
      const res = await validateWithCDP(t.name);
      cdpResults.push(res);
      if (!JSON_OUTPUT) {
        if (res.valid) {
          console.log(`  ✅ [CDP VALID] ${t.name.padEnd(24)} | Passed ${res.passedChecks}/${res.totalChecks} Checks | Outcome: ${res.outcome}`);
        } else {
          console.log(`  ❌ [CDP ERROR] ${t.name.padEnd(24)} | Error: ${res.error || 'Validation failed'}`);
        }
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      target: TARGET,
      timestamp: new Date().toISOString(),
      durationSeconds: duration,
      surfaces: surfaceResults,
      challenges: challengeResults,
      cdpValidation: cdpResults
    }, null, 2));
    return;
  }

  // Summary & Cataloging Guide
  console.log(`\n======================================================================`);
  console.log(`📊 Validation Audit Summary (${duration}s)`);
  console.log(`======================================================================`);
  const surfacesPassed = surfaceResults.filter(s => s.ok).length;
  const challengesPassed = challengeResults.filter(c => c.is402 && c.decoded).length;
  const cdpPassed = cdpResults.filter(c => c.valid).length;

  console.log(`  • Discovery Surfaces:   ${surfacesPassed}/${DISCOVERY_SURFACES.length} Online`);
  console.log(`  • 402 Challenges:       ${challengesPassed}/${PAID_TOOLS.length} Valid x402 v2`);
  if (!SKIP_CDP) {
    console.log(`  • CDP Preflight Checks: ${cdpPassed}/${PAID_TOOLS.length} Fully Validated by Coinbase`);
  }

  console.log(`\n======================================================================`);
  console.log(`🚀 Multi-Directory Submission & Registry Instructions`);
  console.log(`======================================================================`);

  console.log(`\n1️⃣  Coinbase CDP Bazaar:`);
  console.log(`   - Validation API: POST https://api.cdp.coinbase.com/platform/v2/x402/validate`);
  console.log(`   - Seed Settlement: Send 1 mainnet payment ($0.10 USDC) on Base (eip155:8453) to trigger ranking.`);
  console.log(`   - Command: curl -sS -X POST https://api.cdp.coinbase.com/platform/v2/x402/validate -H 'Content-Type: application/json' -d '{"resource":"${TARGET}/api/consult/oracle_ask","method":"POST"}'`);

  console.log(`\n2️⃣  AgentCash Directory:`);
  console.log(`   - Discover: npx agentcash@latest discover ${TARGET}`);
  console.log(`   - Add Skill: npx agentcash@latest add ${TARGET}`);
  console.log(`   - Test Fetch: npx agentcash@latest fetch ${TARGET}/api/consult/oracle_ask -m POST -b '{"question":"Why is my Bazaar listing unranked?"}'`);

  console.log(`\n3️⃣  Smithery (MCP Registry):`);
  console.log(`   - Manifest: ${TARGET}/.well-known/mcp.json or ./smithery.json`);
  console.log(`   - Transport: Streamable-HTTP at ${TARGET}/mcp`);
  console.log(`   - CLI: npx @smithery/cli install @kwizzlesurp10-ctrl/x402orcle`);

  console.log(`\n4️⃣  OpenAgents / A2A Protocol:`);
  console.log(`   - Agent Card: ${TARGET}/.well-known/agent-card.json`);
  console.log(`   - Federation Index: ${TARGET}/.well-known/agents.json`);

  console.log(`\n5️⃣  LangChain & LlamaIndex Swarms:`);
  console.log(`   - Python Toolkit: scripts/langchain_llamaindex_tools.py`);
  console.log(`   - TypeScript Toolkit: scripts/langchain_llamaindex_tools.ts`);
  console.log(`   - OpenAPI Spec: ${TARGET}/openapi.json\n`);
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
