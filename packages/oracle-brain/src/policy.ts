const KEY_ASK =
  /\b(private[_\s-]?key|evm_private_key|seed[_\s-]?phrase|mnemonic|secret[_\s-]?key)\b/i;
const HEX_KEY = /0x[a-fA-F0-9]{64}/;

export type PolicyFail = {
  ok: false;
  code: "MAX_PRICE" | "KEY_SOLICITATION" | "KEY_MATERIAL" | "UNKNOWN_TOOL" | "FREE_MISPRICE";
  message: string;
};

export type PolicyPass = { ok: true };

export function gatePaidTool(opts: {
  toolName: string;
  priceUsd: number;
  maxPriceUsd: number;
  userText?: string;
}): PolicyPass | PolicyFail {
  if (opts.priceUsd > opts.maxPriceUsd) {
    return {
      ok: false,
      code: "MAX_PRICE",
      message: `Price ${opts.priceUsd} exceeds MAX_PRICE_USD=${opts.maxPriceUsd}`,
    };
  }
  const text = opts.userText ?? "";
  if (KEY_ASK.test(text) && /please|send|paste|provide|share/i.test(text)) {
    return {
      ok: false,
      code: "KEY_SOLICITATION",
      message: "Oracle refuses to collect private keys. Use a dedicated low-balance burner locally.",
    };
  }
  if (HEX_KEY.test(text)) {
    return {
      ok: false,
      code: "KEY_MATERIAL",
      message: "Input looks like a 32-byte key. Strip secrets; send addresses and 402 headers only.",
    };
  }
  return { ok: true };
}

export function refuseKeyRequestMessage(): string {
  return [
    "The Oracle never requests or stores private keys.",
    "Seller hosts take X402_PAY_TO (address) + facilitator URL only.",
    "Buyer spend keys stay on the operator laptop (66-char 0x hex), never Vercel/Render.",
  ].join(" ");
}
