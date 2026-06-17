"use client";

import { useEffect, useRef } from "react";

// Renders the v1 OpenAPI spec with Swagger UI. The Swagger UI assets are loaded
// from a CDN rather than added as an npm dependency (neither swagger-ui-react
// nor redoc was in the tree, and they are heavy). The viewer reads the spec
// from /api/v1/openapi.json.
const CSS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
const JS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";

export default function SwaggerDocs() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!document.querySelector(`link[href="${CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS;
      document.head.appendChild(link);
    }

    const init = () => {
      const w = window as unknown as { SwaggerUIBundle?: (opts: Record<string, unknown>) => void };
      if (w.SwaggerUIBundle && ref.current) {
        w.SwaggerUIBundle({ url: "/api/v1/openapi.json", domNode: ref.current, deepLinking: true });
      }
    };

    const existing = document.querySelector(`script[src="${JS}"]`);
    if (existing) {
      init();
    } else {
      const script = document.createElement("script");
      script.src = JS;
      script.onload = init;
      document.body.appendChild(script);
    }
  }, []);

  return <div ref={ref} className="bg-white rounded-lg overflow-hidden" />;
}
