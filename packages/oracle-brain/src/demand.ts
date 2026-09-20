/**
 * 402 challenge funnel counters — parity with x402-mcp demand.py.
 * Never throws into the request path.
 */

export type DemandResource = {
  resource: string;
  challenges_served: number;
  sales_settled: number;
  sales_external: number;
  sales_operator: number;
  sales_unknown: number;
  revenue_usdc: number;
  conversion: number;
  last_challenge_at?: string;
};

const challenges = new Map<string, number>();
const lastSeen = new Map<string, string>();
const sales = new Map<
  string,
  { settled: number; external: number; operator: number; unknown: number; revenue: number }
>();

export function recordChallenge(resource: string): void {
  try {
    const key = resource.trim() || "unknown";
    challenges.set(key, (challenges.get(key) ?? 0) + 1);
    lastSeen.set(key, new Date().toISOString());
  } catch {
    // ignore
  }
}

export function recordDemandSale(input: {
  resource: string;
  amountUsd: number;
  isOperatorSettle: boolean | null;
}): void {
  try {
    const key = input.resource.trim() || "unknown";
    const cur = sales.get(key) ?? {
      settled: 0,
      external: 0,
      operator: 0,
      unknown: 0,
      revenue: 0,
    };
    cur.settled += 1;
    cur.revenue += input.amountUsd;
    if (input.isOperatorSettle === true) cur.operator += 1;
    else if (input.isOperatorSettle === false) cur.external += 1;
    else cur.unknown += 1;
    sales.set(key, cur);
  } catch {
    // ignore
  }
}

export function demandSnapshot(): { resources: DemandResource[] } {
  const keys = new Set([...challenges.keys(), ...sales.keys()]);
  const resources: DemandResource[] = [];
  for (const key of keys) {
    const challenges_served = challenges.get(key) ?? 0;
    const s = sales.get(key) ?? {
      settled: 0,
      external: 0,
      operator: 0,
      unknown: 0,
      revenue: 0,
    };
    const denom = Math.max(1, challenges_served);
    resources.push({
      resource: key,
      challenges_served,
      sales_settled: s.settled,
      sales_external: s.external,
      sales_operator: s.operator,
      sales_unknown: s.unknown,
      revenue_usdc: Number(s.revenue.toFixed(6)),
      conversion: Number((s.external / denom).toFixed(4)),
      last_challenge_at: lastSeen.get(key),
    });
  }
  resources.sort((a, b) => b.revenue_usdc - a.revenue_usdc || b.challenges_served - a.challenges_served);
  return { resources };
}

export function _resetDemandMemoryForTests(): void {
  challenges.clear();
  lastSeen.clear();
  sales.clear();
}
