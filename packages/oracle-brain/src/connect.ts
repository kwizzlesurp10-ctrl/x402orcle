import { FREE_TOOLS, PAID_TOOLS, SERVICE, clampPrice } from "./catalog.js";
import { demandSnapshot, type DemandResource } from "./demand.js";
import { type OracleEnv } from "./env.js";
import { readRevenue, revenueSummary, type RevenueRow } from "./ledger.js";
import { DEFAULT_PAY_TO } from "./payto.js";
import { ORACLE_CONNECT_HOWTO } from "./persona.js";

export type ConnectDocument = {
  ok: true;
  linked: true;
  service: string;
  slug: string;
  version: string;
  connect: string;
  health: {
    ok: true;
    service: string;
    slug: string;
    version: string;
    pay_to: string;
    pay_to_matches_default: boolean;
    pay_to_retired_warning: boolean;
    wallet_configured: false;
    pay_to_configured: true;
    cdp_auth_configured: boolean;
    seller_leak_warning: boolean;
    demoMode: boolean;
    network: string;
    thesis: string;
  };
  pricing: {
    maxPriceUsd: number;
    network: string;
    payTo: string;
    connect: string;
    free: Array<{ name: string; path: string }>;
    paid: Array<{ name: string; path: string; method: string; priceUsd: number }>;
  };
  wallet: {
    receive_address: string;
    vault_address: null;
    balances: null;
    network: string;
    wallet_configured: false;
    note: string;
  };
  revenue: RevenueRow[];
  revenue_summary: ReturnType<typeof revenueSummary>;
  demand: { resources: DemandResource[] };
};

/** Live connect snapshot. Counts come from the process ledger and demand maps. */
export function connectDocument(env: OracleEnv): ConnectDocument {
  const revenue = readRevenue(50);
  return {
    ok: true,
    linked: true,
    service: SERVICE.name,
    slug: SERVICE.slug,
    version: SERVICE.version,
    connect: ORACLE_CONNECT_HOWTO,
    health: {
      ok: true,
      service: SERVICE.name,
      slug: SERVICE.slug,
      version: SERVICE.version,
      pay_to: env.payTo,
      pay_to_matches_default: env.payTo.toLowerCase() === DEFAULT_PAY_TO.toLowerCase(),
      pay_to_retired_warning: env.payToRetiredWarning,
      wallet_configured: false,
      pay_to_configured: true,
      cdp_auth_configured: Boolean(env.cdpApiKeyId && env.cdpApiKeySecret),
      seller_leak_warning: env.sellerLeakWarning,
      demoMode: env.demoMode,
      network: env.network,
      thesis: SERVICE.thesis,
    },
    pricing: {
      maxPriceUsd: env.maxPriceUsd,
      network: env.network,
      payTo: env.payTo,
      connect: ORACLE_CONNECT_HOWTO,
      free: FREE_TOOLS.map((tool) => ({ name: tool.name, path: tool.httpPath })),
      paid: PAID_TOOLS.map((tool) => ({
        name: tool.name,
        path: tool.httpPath,
        method: tool.httpMethod,
        priceUsd: clampPrice(tool, undefined, env.maxPriceUsd),
      })),
    },
    wallet: {
      receive_address: env.payTo,
      vault_address: null,
      balances: null,
      network: env.network,
      wallet_configured: false,
      note: "Receive-only cashier. This document never returns key material.",
    },
    revenue,
    revenue_summary: revenueSummary(revenue),
    demand: demandSnapshot(),
  };
}
