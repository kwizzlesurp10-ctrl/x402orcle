"use client";

import { useState } from "react";
import { validatePaymentEnvelope, type SigValidationResult } from "@x402orcle/oracle-brain/validator";
import { CopyButton } from "./CopyButton";

const SAMPLE_VALID_ENVELOPE = {
  x402Version: 2,
  accepted: {
    scheme: "exact",
    network: "eip155:8453",
    amount: "100000",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
  },
  payload: {
    signature: "0x8f2a1b9c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    authorization: {
      from: "0x3a4f100200300400500600700800900a00b00c0d",
      to: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      value: "100000",
      validAfter: "0",
      validBefore: String(Math.floor(Date.now() / 1000) + 3600),
      nonce: "0x9c2d7e4b1a8f3056c820e14d3b6a95f0e718293a4b5c6d7e8f9a0b1c2d3e4f5a",
    },
  },
};

const SAMPLE_EXPIRED_ENVELOPE = {
  x402Version: 2,
  accepted: {
    scheme: "exact",
    network: "eip155:8453",
    amount: "100000",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
  },
  payload: {
    signature: "0x8f2a1b9c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    authorization: {
      from: "0x3a4f100200300400500600700800900a00b00c0d",
      to: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      value: "100000",
      validAfter: "0",
      validBefore: "1600000000", // Expired timestamp
      nonce: "0x1234",
    },
  },
};

export function SigValidatorWorkbench({
  payTo,
  network,
}: {
  payTo: string;
  network: string;
}) {
  const [inputRaw, setInputRaw] = useState<string>(
    JSON.stringify(SAMPLE_VALID_ENVELOPE, null, 2)
  );

  const [result, setResult] = useState<SigValidationResult>(() =>
    validatePaymentEnvelope(SAMPLE_VALID_ENVELOPE, payTo, network)
  );

  const handleValidate = (text: string) => {
    setInputRaw(text);
    const res = validatePaymentEnvelope(text, payTo, network);
    setResult(res);
  };

  const loadSample = (valid: boolean) => {
    const data = valid ? SAMPLE_VALID_ENVELOPE : SAMPLE_EXPIRED_ENVELOPE;
    // update validBefore for valid sample
    if (valid) {
      data.payload.authorization.validBefore = String(Math.floor(Date.now() / 1000) + 3600);
    }
    const str = JSON.stringify(data, null, 2);
    setInputRaw(str);
    setResult(validatePaymentEnvelope(data, payTo, network));
  };

  const loadBase64Sample = () => {
    SAMPLE_VALID_ENVELOPE.payload.authorization.validBefore = String(Math.floor(Date.now() / 1000) + 3600);
    const b64 = btoa(JSON.stringify(SAMPLE_VALID_ENVELOPE));
    setInputRaw(b64);
    setResult(validatePaymentEnvelope(b64, payTo, network));
  };

  return (
    <section className="validator-workbench-panel">
      <div className="section-header-block">
        <h2 className="section-title">🔬 Cryptographic Inspector & Signature Verifier</h2>
        <p className="section-subtitle">
          Test and verify any x402 payment authorization signature or base64 envelope against Base EIP-712 / EIP-3009 transfer invariants.
        </p>
      </div>

      <div className="workbench-grid">
        {/* Input Column */}
        <div className="workbench-col">
          <div className="col-header-row">
            <label htmlFor="sig-input-area" className="field-label">Paste Raw Base64 Header or Envelope JSON</label>
            <div className="sample-btn-group">
              <button
                type="button"
                className="btn-text"
                onClick={() => loadSample(true)}
              >
                Valid Sample
              </button>
              <button
                type="button"
                className="btn-text"
                onClick={loadBase64Sample}
              >
                Base64 Format
              </button>
              <button
                type="button"
                className="btn-text highlight-warn"
                onClick={() => loadSample(false)}
              >
                Expired Sample
              </button>
            </div>
          </div>

          <textarea
            id="sig-input-area"
            className="input-textarea"
            rows={10}
            value={inputRaw}
            onChange={(e) => handleValidate(e.target.value)}
            placeholder="Paste PAYMENT-SIGNATURE base64 header or raw JSON..."
          />

          <div className="workbench-actions margin-top-xs">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => handleValidate(inputRaw)}
            >
              ⚡ Re-Validate Signature
            </button>
            <CopyButton text={inputRaw} label="Copy Payload" className="btn-sm" />
          </div>
        </div>

        {/* Results / Checks Matrix Column */}
        <div className="workbench-col">
          <div className="score-summary-card">
            <div className="score-header">
              <span className="score-label">VERIFICATION SCORE</span>
              <span
                className={`score-badge ${
                  result.score === 100
                    ? "badge-green"
                    : result.score >= 70
                    ? "badge-amber"
                    : "badge-crimson"
                }`}
              >
                {result.score}% {result.isValid ? "AIRTIGHT" : "VALIDATION FAILED"}
              </span>
            </div>
            <div className="score-bar-bg">
              <div
                className="score-bar-fill"
                style={{
                  width: `${result.score}%`,
                  backgroundColor:
                    result.score === 100 ? "#00ff9d" : result.score >= 70 ? "#ffb700" : "#ff2a5f",
                }}
              />
            </div>
          </div>

          {/* Validation Checks Checklist */}
          <div className="checks-list margin-top-xs">
            {result.checks.map((check, idx) => (
              <div key={idx} className={`check-item ${check.passed ? "passed" : "failed"}`}>
                <span className="check-icon">{check.passed ? "✓" : "✗"}</span>
                <div className="check-body">
                  <div className="check-name">{check.name}</div>
                  <div className="check-detail">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Decoded Parameters Breakdown */}
          {result.decoded.payer && (
            <div className="decoded-params-wrap margin-top-xs">
              <div className="code-box-header">
                <span>Extracted Transfer Parameters</span>
              </div>
              <div className="params-mini-table">
                <div><span>Payer:</span> <code>{result.decoded.payer}</code></div>
                <div><span>Amount:</span> <strong>{result.decoded.amount} atomic</strong></div>
                <div><span>Destination:</span> <code>{result.decoded.payTo}</code></div>
                <div><span>Network:</span> <code>{result.decoded.network}</code></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
