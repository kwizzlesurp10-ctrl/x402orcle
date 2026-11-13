import { keccak_256 } from "@noble/hashes/sha3";

/** EIP-55 checksum for display only; preserves byte identity (equality via lowercase). */
export function toChecksumAddress(address: string): string {
  const stripped = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(stripped)) {
    return stripped;
  }
  const lower = stripped.slice(2).toLowerCase();
  const hash = Buffer.from(keccak_256(new TextEncoder().encode(lower))).toString("hex");
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    const ch = lower[i]!;
    if (ch >= "a" && ch <= "f" && parseInt(hash[i]!, 16) >= 8) {
      out += ch.toUpperCase();
    } else {
      out += ch;
    }
  }
  return out;
}
