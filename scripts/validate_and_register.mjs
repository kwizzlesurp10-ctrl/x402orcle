#!/usr/bin/env node
/**
 * x402 Oracle Validation & Registry Submission Tool
 * Validates discovery endpoints, CORS headers, HTTP 402 challenge payloads,
 * and generates Bazaar/CDP registration commands.
 */

const TARGET = process.argv.includes('--target') 
  ? process.argv[process.argv.indexOf('--target') + 1] 
  : (process.env.ORACLE_URL || 'https://x402orcle.vercel.app');

const SURFACES = [
  '/',
  '/.well-known/x402',
  '/.well-known/agent-card.json',
  '/.well-known/mcp.json',
  '/.well-known/funding.json',
  '/llms.txt',
  '/agents.txt',
  '/openapi.json',
  '/api/health',
  '/api/pricing'
];

async function runValidation() {
  console.log(`\n======================================================`);
  console.log(`🔍 Auditing x402 Oracle Discovery on: ${TARGET}`);
  console.log(`======================================================\n`);

  let passCount = 0;

  // 1. Probe Discovery Surfaces
  for (const path of SURFACES) {
    const url = `${TARGET}${path}`;
    try {
      const res = await fetch(url);
      const isOk = res.ok;
      const cors = res.headers.get('access-control-allow-origin') || '(none)';
      const type = res.headers.get('content-type') || 'unknown';

      if (isOk) {
        console.log(`✅ [${res.status}] ${path.padEnd(30)} | Type: ${type.split(';')[0].padEnd(16)} | CORS: ${cors}`);
        passCount++;
      } else {
        console.log(`❌ [${res.status}] ${path.padEnd(30)} | FAILED`);
      }
    } catch (err) {
      console.log(`❌ [ERR] ${path.padEnd(30)} | ${err.message}`);
    }
  }

  console.log(`\nSurface Reachability Score: ${passCount}/${SURFACES.length}`);

  // 2. Test HTTP 402 Payment Required Challenge
  console.log(`\n------------------------------------------------------`);
  console.log(`💳 Testing x402 Challenge Format on /api/consult/oracle_ask...`);
  console.log(`------------------------------------------------------`);
  
  try {
    const res = await fetch(`${TARGET}/api/consult/oracle_ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Validate x402 challenge format' })
    });

    if (res.status === 402) {
      const headerVal = res.headers.get('payment-required');
      if (headerVal) {
        const decoded = JSON.parse(Buffer.from(headerVal, 'base64').toString('utf8'));
        console.log(`✅ Received HTTP 402 + Base64 PAYMENT-REQUIRED header`);
        console.log(`   - x402 Version: ${decoded.x402Version || 2}`);
        console.log(`   - Network:      ${decoded.network}`);
        console.log(`   - Asset:        ${decoded.asset}`);
        console.log(`   - PayTo:        ${decoded.pay_to || decoded.payTo}`);
        console.log(`   - Amount (USD): ${decoded.amount ? (Number(decoded.amount) / 1e6) + ' USDC' : 'N/A'}`);
      } else {
        console.log(`⚠️ HTTP 402 returned without PAYMENT-REQUIRED header`);
      }
    } else {
      console.log(`⚠️ Expected HTTP 402, received HTTP ${res.status}`);
    }
  } catch (err) {
    console.log(`❌ 402 probe failed: ${err.message}`);
  }

  // 3. Output Bazaar & CDP Registration Commands
  console.log(`\n======================================================`);
  console.log(`📋 CDP Bazaar Catalog Validation Command`);
  console.log(`======================================================`);
  console.log(`\nRun this command to validate your resource with the Coinbase Facilitator:\n`);
  console.log(`curl -sS -X POST https://api.cdp.coinbase.com/platform/v2/x402/validate \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -d '{"resource":"${TARGET}/api/consult/oracle_ask","method":"POST"}'\n`);
  console.log(`Note: To achieve full ranking on Bazaar, submit one seed settlement on Base Mainnet.\n`);
}

runValidation();
