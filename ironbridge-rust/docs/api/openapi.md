# OpenAPI Reference

Interactive API documentation auto-generated from the [OpenAPI 3.0 spec](../assets/openapi.yaml).

<div id="swagger-ui"></div>

<link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" >

<style>
  /* Match MkDocs Material dark theme */
  .swagger-ui {
    font-family: var(--md-text-font-family, "Inter", sans-serif);
  }

  [data-md-color-scheme="slate"] .swagger-ui {
    filter: invert(88%) hue-rotate(180deg);
  }

  [data-md-color-scheme="slate"] .swagger-ui .model-box,
  [data-md-color-scheme="slate"] .swagger-ui .microlight {
    filter: invert(100%) hue-rotate(180deg);
  }

  .swagger-ui .topbar { display: none; }

  .swagger-ui .info .title { font-size: 1.6rem; }

  .swagger-ui .scheme-container {
    background: transparent;
    box-shadow: none;
    padding: 0;
  }

  /* Remove default component padding that conflicts with MkDocs */
  .swagger-ui .wrapper {
    padding: 0;
    max-width: 100%;
  }

  .swagger-ui .info {
    margin: 20px 0;
  }
</style>

<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>

<script>
document.addEventListener('DOMContentLoaded', function () {
  SwaggerUIBundle({
    url: '../assets/openapi.yaml',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIBundle.SwaggerUIStandalonePreset,
    ],
    layout: "BaseLayout",
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    docExpansion: "list",
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
  });
});
</script>

---

!!! tip "Try It Out"
    Click **Try it out** on any endpoint to send live requests against your local IronBridge API server at `http://localhost:8787`.

!!! info "Keeping in Sync"
    This page is auto-generated from `openapi.yaml` in the repository root. Any changes to the API server are reflected here after rebuilding the docs site.
