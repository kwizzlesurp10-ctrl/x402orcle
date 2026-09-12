#!/usr/bin/env node
/**
 * Swarm Oracle Client
 * Enables autonomous agent swarms to discover and query x402 Oracle.
 * Supports:
 *  - Free operator usage routes (/api/health, /api/pricing)
 *  - Paid consult routes via x402 PAYMENT-SIGNATURE
 *  - A2A (Agent-to-Agent) card ingestion & crawler toolchain registration
 */

import { execSync } from 'child_process';

const ORACLE_BASE = process.env.ORACLE_URL || 'https://x402orcle.vercel.app';

export async function discoverOracleA2A() {
  try {
    const res = await fetch(`${ORACLE_BASE}/.well-known/agent-card.json`);
    const card = await res.json();
    console.log(`[Swarm] Discovered Oracle Agent: "${card.name}"`);
    console.log(`[Swarm] Protocol: ${card.protocolVersion} | Skills: ${card.skills?.length || 0}`);
    return card;
  } catch (err) {
    console.error('[Swarm Discovery Error]', err.message);
    return null;
  }
}

export async function queryOracleFree(action = 'health') {
  const url = `${ORACLE_BASE}/api/${action}`;
  console.log(`[Swarm Free Query] -> ${url}`);
  const res = await fetch(url);
  return await res.json();
}

export async function queryOraclePaid(question, method = 'POST') {
  const url = `${ORACLE_BASE}/api/consult/oracle_ask`;
  console.log(`[Swarm Paid Query] -> ${url}`);
  console.log(`[Swarm Question] "${question}"`);

  // First probe to get 402 challenge
  const probeRes = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  if (probeRes.status === 402) {
    console.log('[Swarm 402] Payment Required challenge received. Settling via x402 payment rails...');
    try {
      // Execute via agentcash or coinbase CLI
      const cmd = `npx -y agentcash@latest fetch "${url}" -m POST -b '{"question": "${question.replace(/"/g, '\\"')}"}'`;
      const out = execSync(cmd, { encoding: 'utf8' });
      return JSON.parse(out);
    } catch (e) {
      console.warn('[Swarm Settle Fallback]', e.message);
    }
  }

  return await probeRes.json();
}

// CLI direct run demo
if (process.argv[1]?.endsWith('swarm_oracle_client.mjs')) {
  console.log('--- Initializing Swarm Oracle Node ---');
  discoverOracleA2A().then(card => {
    queryOracleFree('pricing').then(pricing => {
      console.log('[Swarm Oracle Pricing Matrix]:', pricing);
    });
  });
}
