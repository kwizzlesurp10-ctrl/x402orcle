import { z } from "zod";
import { getTool, type OracleToolSpec } from "./catalog.js";

const oracleAskSchema = z.object({
  question: z.string().min(1),
  audience: z.string().optional(),
});

const oracleDiagnose402Schema = z.object({
  challenge_b64_or_json: z.string().min(1),
  resource_url: z.string().url().optional(),
});

const oracleReviewMcpSchema = z.object({
  mcp_url: z.string().min(1),
  notes: z.string().optional(),
});

const oracleBazaarRewriteSchema = z.object({
  current_description: z.string().optional(),
  buyer_phrases: z.array(z.string()).optional(),
});

const completeOracleTaskSchema = z.object({
  goal: z.string().min(1),
  constraints: z.string().optional(),
});

const SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  oracle_ask: oracleAskSchema,
  oracle_diagnose_402: oracleDiagnose402Schema,
  oracle_review_mcp: oracleReviewMcpSchema,
  oracle_bazaar_rewrite: oracleBazaarRewriteSchema,
  complete_oracle_task: completeOracleTaskSchema,
};

export type ConsultInputIssue = { path: string; message: string };

export type ConsultInputValidation =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; code: "INVALID_REQUEST"; message: string; issues: ConsultInputIssue[] };

function formatIssues(error: z.ZodError): ConsultInputIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

export function validateConsultInput(
  tool: OracleToolSpec,
  raw: Record<string, unknown>,
): ConsultInputValidation {
  if (tool.tier !== "paid") {
    return { ok: true, input: raw };
  }
  const schema = SCHEMAS[tool.name];
  if (!schema) {
    return { ok: true, input: raw };
  }
  const stripped = { ...raw };
  delete stripped.payment;
  const parsed = schema.safeParse(stripped);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: `Invalid request for ${tool.name}`,
      issues: formatIssues(parsed.error),
    };
  }
  return { ok: true, input: parsed.data as Record<string, unknown> };
}

export function isPaidConsultTool(name: string): boolean {
  const tool = getTool(name);
  return tool?.tier === "paid";
}
