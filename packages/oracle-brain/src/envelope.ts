import { z } from "zod";

export const WisdomEnvelopeSchema = z.object({
  verdict: z.string().min(1),
  wisdom: z.string().min(1),
  implementation_prompt: z.string().min(1),
  risk: z.string().min(1),
  citations: z.array(z.string()),
  receipt: z
    .object({
      tool: z.string(),
      priceUsd: z.number(),
      network: z.string(),
      payTo: z.string(),
      mode: z.enum(["demo", "live"]),
      settlementId: z.string().optional(),
      transaction: z.string().optional(),
      payer: z.string().optional(),
      paidAt: z.string(),
    })
    .optional(),
  human: z.string(),
  agent: z.record(z.string(), z.unknown()),
});

export type WisdomEnvelope = z.infer<typeof WisdomEnvelopeSchema>;

export function envelope(partial: Omit<WisdomEnvelope, "human" | "agent"> & { human?: string; agent?: Record<string, unknown> }): WisdomEnvelope {
  const human =
    partial.human ??
    `${partial.verdict}\n\n${partial.wisdom}\n\nImplementation prompt:\n${partial.implementation_prompt}\n\nRisk: ${partial.risk}`;
  const agent =
    partial.agent ??
    {
      verdict: partial.verdict,
      wisdom: partial.wisdom,
      implementation_prompt: partial.implementation_prompt,
      risk: partial.risk,
      citations: partial.citations,
      receipt: partial.receipt,
    };
  return WisdomEnvelopeSchema.parse({ ...partial, human, agent });
}
