import { randomUUID } from "node:crypto";
import { clampPrice, requireTool, type OracleToolSpec } from "./catalog.js";
import { buildPaymentRequired, type PaymentRequired } from "./challenge.js";
import type { OracleEnv } from "./env.js";
import { handleConsult } from "./http.js";

export type A2aTaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "auth-required"
  | "completed"
  | "failed"
  | "canceled";

export type A2aTask = {
  kind: "task";
  id: string;
  contextId: string;
  status: {
    state: A2aTaskState;
    message?: A2aMessage;
    timestamp?: string;
  };
  artifacts?: Array<{ name: string; parts: A2aPart[] }>;
  metadata?: Record<string, unknown>;
};

export type A2aPart = {
  kind: "text" | "data";
  text?: string;
  data?: Record<string, unknown>;
};

export type A2aMessage = {
  kind: "message";
  messageId: string;
  role: "user" | "agent";
  parts: A2aPart[];
  taskId?: string;
  contextId?: string;
  metadata?: Record<string, unknown>;
};

const taskStore = new Map<string, A2aTask>();

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeMethod(method: string | undefined): string {
  if (!method) return "";
  const m = method.trim();
  if (m === "message/send" || m === "SendMessage") return "SendMessage";
  if (m === "tasks/get" || m === "GetTask") return "GetTask";
  return m;
}

function extractSkillInput(message: A2aMessage): { skillId: string; input: Record<string, unknown> } {
  const meta = message.metadata ?? {};
  const skillId =
    (typeof meta.skillId === "string" && meta.skillId) ||
    (typeof meta["x402orcle.skill"] === "string" && (meta["x402orcle.skill"] as string)) ||
    "";
  let input: Record<string, unknown> = {};
  if (meta.input && typeof meta.input === "object" && !Array.isArray(meta.input)) {
    input = meta.input as Record<string, unknown>;
  }
  for (const part of message.parts) {
    if (part.kind === "data" && part.data) {
      if (!skillId && typeof part.data.skillId === "string") {
        Object.assign(input, part.data);
      } else {
        input = { ...input, ...part.data };
      }
    }
    if (part.kind === "text" && part.text && !input.question && skillId === "oracle_ask") {
      input.question = part.text;
    }
  }
  if (skillId && !input.skillId) {
    const { skillId: _s, ...rest } = input;
    input = rest;
  }
  return { skillId, input };
}

function paymentFromMessage(message: A2aMessage): unknown | null {
  const meta = message.metadata ?? {};
  const status = meta["x402.payment.status"];
  if (status === "payment-submitted" || status === "payment-verified") {
    return meta["x402.payment.payload"] ?? null;
  }
  return meta["x402.payment.payload"] ?? null;
}

function paymentRequiredTask(opts: {
  env: OracleEnv;
  tool: OracleToolSpec;
  taskId: string;
  contextId: string;
  input: Record<string, unknown>;
  state: "input-required" | "auth-required";
}): A2aTask {
  const priceUsd = clampPrice(opts.tool, undefined, opts.env.maxPriceUsd);
  const required = buildPaymentRequired({
    env: opts.env,
    tool: opts.tool,
    priceUsd,
    transport: "http",
  });
  return {
    kind: "task",
    id: opts.taskId,
    contextId: opts.contextId,
    status: {
      state: opts.state,
      timestamp: nowIso(),
      message: {
        kind: "message",
        messageId: randomUUID(),
        role: "agent",
        taskId: opts.taskId,
        contextId: opts.contextId,
        parts: [
          {
            kind: "text",
            text: `Payment is required to run skill ${opts.tool.name} ($${priceUsd} USDC on ${opts.env.network}).`,
          },
          { kind: "data", data: { skillId: opts.tool.name, input: opts.input } },
        ],
        metadata: {
          "x402.payment.status": "payment-required",
          "x402.payment.required": required,
        },
      },
    },
    metadata: { skillId: opts.tool.name },
  };
}

function completedTask(opts: {
  taskId: string;
  contextId: string;
  tool: OracleToolSpec;
  result: unknown;
  receipts?: unknown[];
}): A2aTask {
  return {
    kind: "task",
    id: opts.taskId,
    contextId: opts.contextId,
    status: {
      state: "completed",
      timestamp: nowIso(),
      message: {
        kind: "message",
        messageId: randomUUID(),
        role: "agent",
        taskId: opts.taskId,
        contextId: opts.contextId,
        parts: [{ kind: "data", data: { skillId: opts.tool.name, result: opts.result } }],
        metadata: {
          "x402.payment.status": "payment-completed",
          "x402.payment.receipts": opts.receipts ?? [],
        },
      },
    },
    artifacts: [
      {
        name: opts.tool.name,
        parts: [{ kind: "data", data: opts.result as Record<string, unknown> }],
      },
    ],
    metadata: { skillId: opts.tool.name },
  };
}

function failedTask(taskId: string, contextId: string, error: string): A2aTask {
  return {
    kind: "task",
    id: taskId,
    contextId,
    status: {
      state: "failed",
      timestamp: nowIso(),
      message: {
        kind: "message",
        messageId: randomUUID(),
        role: "agent",
        taskId,
        contextId,
        parts: [{ kind: "text", text: error }],
        metadata: { "x402.payment.status": "payment-failed" },
      },
    },
  };
}

export async function handleA2aJsonRpc(opts: {
  env: OracleEnv;
  body: {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: Record<string, unknown>;
  };
  fetchImpl?: typeof fetch;
}): Promise<{ status: number; body: unknown }> {
  const id = opts.body.id ?? null;
  const method = normalizeMethod(opts.body.method);
  if (!method) {
    return {
      status: 200,
      body: { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } },
    };
  }

  if (method === "GetTask") {
    const params = opts.body.params ?? {};
    const taskId = typeof params.id === "string" ? params.id : "";
    const task = taskStore.get(taskId);
    if (!task) {
      return {
        status: 200,
        body: { jsonrpc: "2.0", id, error: { code: -32001, message: `Task not found: ${taskId}` } },
      };
    }
    return { status: 200, body: { jsonrpc: "2.0", id, result: task } };
  }

  if (method !== "SendMessage") {
    return {
      status: 200,
      body: { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${opts.body.method}` } },
    };
  }

  const params = opts.body.params ?? {};
  const message = params.message as A2aMessage | undefined;
  if (!message || !Array.isArray(message.parts)) {
    return {
      status: 200,
      body: { jsonrpc: "2.0", id, error: { code: -32602, message: "params.message is required" } },
    };
  }

  const taskId = message.taskId || randomUUID();
  const contextId = message.contextId || randomUUID();
  const { skillId, input } = extractSkillInput(message);
  if (!skillId) {
    const task = failedTask(taskId, contextId, "skillId metadata (or data.skillId) is required");
    taskStore.set(taskId, task);
    return { status: 200, body: { jsonrpc: "2.0", id, result: task } };
  }

  let tool: OracleToolSpec;
  try {
    tool = requireTool(skillId);
  } catch {
    const task = failedTask(taskId, contextId, `Unknown skill: ${skillId}`);
    taskStore.set(taskId, task);
    return { status: 200, body: { jsonrpc: "2.0", id, result: task } };
  }

  const payment = paymentFromMessage(message);
  if (tool.tier === "paid" && !payment) {
    const task = paymentRequiredTask({
      env: opts.env,
      tool,
      taskId,
      contextId,
      input,
      state: "input-required",
    });
    taskStore.set(taskId, task);
    return { status: 200, body: { jsonrpc: "2.0", id, result: task } };
  }

  const consult = await handleConsult({
    env: opts.env,
    toolName: tool.name,
    input,
    payment: tool.tier === "paid" ? payment : null,
    transport: "http",
    fetchImpl: opts.fetchImpl,
  });

  if (consult.status === 402) {
    const pr = consult.body as PaymentRequired;
    const task: A2aTask = {
      kind: "task",
      id: taskId,
      contextId,
      status: {
        state: "input-required",
        timestamp: nowIso(),
        message: {
          kind: "message",
          messageId: randomUUID(),
          role: "agent",
          taskId,
          contextId,
          parts: [
            {
              kind: "text",
              text: "Payment verification failed or payment is required.",
            },
          ],
          metadata: {
            "x402.payment.status": "payment-required",
            "x402.payment.required": pr,
            ...(typeof (consult.body as { facilitator_error?: string }).facilitator_error === "string"
              ? { "x402.payment.error": (consult.body as { facilitator_error: string }).facilitator_error }
              : {}),
          },
        },
      },
      metadata: { skillId: tool.name },
    };
    taskStore.set(taskId, task);
    return { status: 200, body: { jsonrpc: "2.0", id, result: task } };
  }

  if (consult.status === 400) {
    const task = failedTask(taskId, contextId, JSON.stringify(consult.body));
    taskStore.set(taskId, task);
    return { status: 200, body: { jsonrpc: "2.0", id, result: task } };
  }

  const task = completedTask({
    taskId,
    contextId,
    tool,
    result: consult.body,
  });
  taskStore.set(taskId, task);
  return { status: 200, body: { jsonrpc: "2.0", id, result: task } };
}

export function getA2aTask(taskId: string): A2aTask | undefined {
  return taskStore.get(taskId);
}

export function clearA2aTasksForTests(): void {
  taskStore.clear();
}

export function a2aEndpointUrl(env: OracleEnv): string {
  return `${env.publicBaseUrl.replace(/\/$/, "")}/a2a`;
}
