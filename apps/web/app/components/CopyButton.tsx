"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`copy-btn ${copied ? "copied" : ""} ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <span className="copy-icon">✓</span>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <span className="copy-icon">📋</span>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
