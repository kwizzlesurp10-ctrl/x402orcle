/**
 * Settled-sale ledger — parity with x402-mcp revenue visibility.
 * Recording must never throw into a paid request path.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type RevenueRow = {
  ts: string;
  kind: "revenue";
  product_id: string;
  network: string;
  amount_usdc: number;
  amount_usdc_atomic: number;
  tx?: string;
  settled: true;
  payer?: string;
  pay_to: string;
  mode: "live" | "demo";
  is_operator_settle: boolean | null;
};

const MEMORY_CAP = 2000;
const memory: RevenueRow[] = [];

function ledgerDir(): string | null {
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") return null;
  if (process.env.VERCEL === "1" && !process.env.LEDGER_DIR) return null;
  return process.env.LEDGER_DIR || join(process.cwd(), "ledger");
}

function revenuePath(): string | null {
  const dir = ledgerDir();
  return dir ? join(dir, "revenue.jsonl") : null;
}

export function parseOperatorWallets(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const w = part.trim().toLowerCase();
    if (w.startsWith("0x") && w.length === 42) out.add(w);
  }
  return out;
}

export function classifyOperatorSettle(
  payer: string | undefined,
  operatorWallets: Set<string>,
): boolean | null {
  if (!payer || operatorWallets.size === 0) return null;
  try {
    return operatorWallets.has(payer.toLowerCase());
  } catch {
    return null;
  }
}

export function recordRevenue(input: {
  productId: string;
  network: string;
  amountUsd: number;
  tx?: string;
  payer?: string;
  payTo: string;
  mode: "live" | "demo";
  operatorWallets?: Set<string>;
}): RevenueRow | null {
  try {
    const wallets = input.operatorWallets ?? parseOperatorWallets(process.env.OPERATOR_WALLETS);
    const amount_usdc = Number(input.amountUsd);
    if (!Number.isFinite(amount_usdc) || amount_usdc < 0) return null;
    const row: RevenueRow = {
      ts: new Date().toISOString(),
      kind: "revenue",
      product_id: input.productId,
      network: input.network,
      amount_usdc,
      amount_usdc_atomic: Math.round(amount_usdc * 1_000_000),
      tx: input.tx,
      settled: true,
      payer: input.payer,
      pay_to: input.payTo,
      mode: input.mode,
      is_operator_settle: classifyOperatorSettle(input.payer, wallets),
    };
    memory.push(row);
    if (memory.length > MEMORY_CAP) memory.splice(0, memory.length - MEMORY_CAP);
    const path = revenuePath();
    if (path) {
      try {
        mkdirSync(dirname(path), { recursive: true });
        appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");
      } catch {
        // disk optional
      }
    }
    return row;
  } catch {
    return null;
  }
}

function readDiskRows(): RevenueRow[] {
  const path = revenuePath();
  if (!path || !existsSync(path)) return [];
  try {
    const rows: RevenueRow[] = [];
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        rows.push(JSON.parse(t) as RevenueRow);
      } catch {
        // skip bad line
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export function readRevenue(limit = 1000): RevenueRow[] {
  const disk = readDiskRows();
  const byKey = new Map<string, RevenueRow>();
  for (const row of [...disk, ...memory]) {
    const key = `${row.ts}|${row.tx ?? ""}|${row.product_id}|${row.amount_usdc_atomic}|${row.payer ?? ""}|${row.mode}`;
    byKey.set(key, row);
  }
  const wallets = parseOperatorWallets(process.env.OPERATOR_WALLETS);
  const merged = [...byKey.values()].map((row) => ({
    ...row,
    is_operator_settle:
      row.is_operator_settle !== undefined && row.is_operator_settle !== null
        ? row.is_operator_settle
        : classifyOperatorSettle(row.payer, wallets),
  }));
  merged.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return merged.slice(0, Math.max(1, limit));
}

export function revenueSummary(rows?: RevenueRow[]): {
  revenue_usdc: number;
  settled_sales: number;
  external_usdc: number;
  operator_usdc: number;
  unknown_usdc: number;
  external_sales: number;
  operator_sales: number;
  unknown_sales: number;
  by_product: Record<string, { revenue_usdc: number; sales: number }>;
} {
  const list = rows ?? readRevenue(10_000);
  let external_usdc = 0;
  let operator_usdc = 0;
  let unknown_usdc = 0;
  let external_sales = 0;
  let operator_sales = 0;
  let unknown_sales = 0;
  const by_product: Record<string, { revenue_usdc: number; sales: number }> = {};
  for (const row of list) {
    const amt = row.amount_usdc;
    const bucket = by_product[row.product_id] ?? { revenue_usdc: 0, sales: 0 };
    bucket.revenue_usdc += amt;
    bucket.sales += 1;
    by_product[row.product_id] = bucket;
    if (row.is_operator_settle === true) {
      operator_usdc += amt;
      operator_sales += 1;
    } else if (row.is_operator_settle === false) {
      external_usdc += amt;
      external_sales += 1;
    } else {
      unknown_usdc += amt;
      unknown_sales += 1;
    }
  }
  return {
    revenue_usdc: external_usdc + operator_usdc + unknown_usdc,
    settled_sales: list.length,
    external_usdc,
    operator_usdc,
    unknown_usdc,
    external_sales,
    operator_sales,
    unknown_sales,
    by_product,
  };
}

/** Test helper — wipe in-memory rows. */
export function _resetLedgerMemoryForTests(): void {
  memory.length = 0;
}
