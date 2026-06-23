import { Router } from "express";
import { buildSpec } from "../openapi/spec";

// Serves the OpenAPI JSON and a CDN-loaded Swagger UI page. Public (the spec
// documents auth but exposes no secrets), matching the original Next behavior.
export const docsRouter = Router();

docsRouter.get("/openapi.json", (_req, res) => {
  res.json(buildSpec());
});

const SWAGGER_CSS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
const SWAGGER_JS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";

docsRouter.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Henley Hub API — v1 docs</title>
    <link rel="stylesheet" href="${SWAGGER_CSS}" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="${SWAGGER_JS}"></script>
    <script>
      window.addEventListener("load", function () {
        window.SwaggerUIBundle({ url: "/api/v1/openapi.json", domNode: document.getElementById("swagger"), deepLinking: true });
      });
    </script>
  </body>
</html>`);
});
