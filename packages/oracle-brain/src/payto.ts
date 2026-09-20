/** Sole-cashier defaults — keep oracle payTo hygiene aligned with x402-mcp. */

/** Live cashier shared with x402-mcp after 2026-09-20 rotation. */
export const DEFAULT_PAY_TO = "0x05e1720bB82F86B5bc7940a99FDC702E32256357" as const;

/** Prefixes that must never be advertised as the live receive wallet. */
export const RETIRED_PAY_TO_PREFIXES = [
  "0xAB745e5F", // prior oracle / leaked Smithery default
  "0xcA6791f9", // leaked cold-receive.key
  "0x8A897D54", // prior mcp cashier
  "0x9138fEA6", // leaked buyer-hot.key
] as const;

export function isRetiredPayTo(address: string): boolean {
  const lower = address.toLowerCase();
  return RETIRED_PAY_TO_PREFIXES.some((p) => lower.startsWith(p.toLowerCase()));
}
