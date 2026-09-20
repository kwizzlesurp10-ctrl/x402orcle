"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export default function DocsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0b0f17" }}>
      <ApiReferenceReact
        configuration={{
          spec: {
            url: "/openapi.json",
          },
          theme: "purple",
          darkMode: true,
          hideDownloadButton: false,
          showSidebar: true,
        }}
      />
    </main>
  );
}
