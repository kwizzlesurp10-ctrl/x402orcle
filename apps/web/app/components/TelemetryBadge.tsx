"use client";

import { useEffect, useState } from "react";

type HealthData = {
  ok: boolean;
  status: string;
  timestamp: string;
  service: string;
  network: string;
  pay_to: string;
  demoMode: boolean;
  cdp_auth_configured: boolean;
};

export function TelemetryBadge() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<boolean>(false);

  const checkHealth = async () => {
    const start = performance.now();
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        const data = (await res.json()) as HealthData;
        setHealth(data);
        setLatency(elapsed);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="telemetry-badge" title="Programmatic operational status & response latency from /api/health">
      <div className="telemetry-status">
        <span className={`status-dot ${error ? "down" : "up"}`} />
        <span className="status-label">
          {error
            ? "UNAVAILABLE"
            : health?.status?.toUpperCase() || "OPERATIONAL"}
        </span>
      </div>
      <div className="telemetry-divider">│</div>
      <div className="telemetry-metric">
        <span className="metric-name">Latency:</span>
        <span className="metric-value">{latency !== null ? `${latency}ms` : "--"}</span>
      </div>
      <div className="telemetry-divider">│</div>
      <div className="telemetry-metric">
        <span className="metric-name">Network:</span>
        <span className="metric-value">{health?.network || "eip155:8453"}</span>
      </div>
      <div className="telemetry-divider">│</div>
      <div className="telemetry-metric">
        <span className="metric-name">Mode:</span>
        <span className="metric-value highlight">
          {health?.demoMode ? "DEMO" : "LIVE (Base Mainnet)"}
        </span>
      </div>
    </div>
  );
}
