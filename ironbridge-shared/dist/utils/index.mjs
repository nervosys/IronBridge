// src/utils/export.ts
function exportToJson(session, options = {}) {
  const { includeMetadata = true } = options;
  const exportData = {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    format: "ironbridge-session-v1",
    session: {
      id: session.id,
      title: session.title,
      provider: session.provider,
      model: session.model,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      ...includeMetadata && session.metadata ? { metadata: session.metadata } : {}
    },
    messages: session.messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      model: msg.model,
      createdAt: msg.createdAt,
      ...options.includeToolInvocations && msg.toolInvocations?.length ? { toolInvocations: msg.toolInvocations } : {},
      ...includeMetadata && msg.metadata ? { metadata: msg.metadata } : {}
    }))
  };
  const content = JSON.stringify(exportData, null, 2);
  const filename = sanitizeFilename(`${session.title || "session"}-${session.id.slice(0, 8)}.json`);
  return {
    content,
    mimeType: "application/json",
    filename,
    blob: new Blob([content], { type: "application/json" })
  };
}
function exportToMarkdown(session, options = {}) {
  const { includeTimestamps = true, includeToolInvocations = false, title, author } = options;
  const lines = [];
  lines.push(`# ${title || session.title || "Chat Session"}`);
  lines.push("");
  lines.push("---");
  lines.push(`provider: ${session.provider}`);
  if (session.model) lines.push(`model: ${session.model}`);
  lines.push(`messages: ${session.messageCount}`);
  lines.push(`created: ${formatDate(session.createdAt)}`);
  lines.push(`updated: ${formatDate(session.updatedAt)}`);
  if (author) lines.push(`author: ${author}`);
  lines.push(`exported: ${formatDate(/* @__PURE__ */ new Date())}`);
  lines.push("---");
  lines.push("");
  for (const message of session.messages) {
    const roleIcon = message.role === "user" ? "\u{1F464}" : message.role === "assistant" ? "\u{1F916}" : "\u2699\uFE0F";
    const roleLabel = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    if (includeTimestamps) {
      lines.push(`## ${roleIcon} ${roleLabel} (${formatTime(message.createdAt)})`);
    } else {
      lines.push(`## ${roleIcon} ${roleLabel}`);
    }
    lines.push("");
    lines.push(message.content);
    lines.push("");
    if (includeToolInvocations && message.toolInvocations?.length) {
      lines.push("<details>");
      lines.push("<summary>Tool Invocations</summary>");
      lines.push("");
      for (const tool of message.toolInvocations) {
        lines.push(`- **${tool.toolName}** (${tool.status || "complete"})`);
        if (tool.invocationMessage) {
          const msg = typeof tool.invocationMessage === "string" ? tool.invocationMessage : tool.invocationMessage.value || JSON.stringify(tool.invocationMessage);
          lines.push(`  - ${msg.slice(0, 200)}${msg.length > 200 ? "..." : ""}`);
        }
      }
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }
  }
  lines.push("---");
  lines.push(`*Exported from IronBridge on ${formatDate(/* @__PURE__ */ new Date())}*`);
  const content = lines.join("\n");
  const filename = sanitizeFilename(`${session.title || "session"}-${session.id.slice(0, 8)}.md`);
  return {
    content,
    mimeType: "text/markdown",
    filename,
    blob: new Blob([content], { type: "text/markdown" })
  };
}
function exportToHtml(session, options = {}) {
  const { includeTimestamps = true, title } = options;
  const escapedTitle = escapeHtml(title || session.title || "Chat Session");
  const messageHtml = session.messages.map((msg) => {
    const roleClass = msg.role === "user" ? "user" : msg.role === "assistant" ? "assistant" : "system";
    const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    const timestamp = includeTimestamps ? `<span class="timestamp">${formatTime(msg.createdAt)}</span>` : "";
    return `
            <div class="message ${roleClass}">
                <div class="message-header">
                    <span class="role">${roleLabel}</span>
                    ${timestamp}
                </div>
                <div class="message-content">${formatMessageContent(msg.content)}</div>
            </div>
        `;
  }).join("\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedTitle}</title>
    <style>
        :root {
            --bg: #1a1a2e;
            --card: #16213e;
            --text: #eee;
            --muted: #888;
            --user-bg: #0f3460;
            --assistant-bg: #1a1a2e;
            --system-bg: #2d2d44;
            --border: #333;
            --accent: #e94560;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            padding: 2rem;
            max-width: 900px;
            margin: 0 auto;
        }
        h1 { margin-bottom: 0.5rem; }
        .meta { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }
        .message {
            background: var(--card);
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1rem;
            border: 1px solid var(--border);
        }
        .message.user { background: var(--user-bg); }
        .message.assistant { background: var(--assistant-bg); }
        .message.system { background: var(--system-bg); }
        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
        }
        .role { font-weight: 600; color: var(--accent); }
        .timestamp { color: var(--muted); }
        .message-content { white-space: pre-wrap; word-wrap: break-word; }
        pre {
            background: #0d0d0d;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            margin: 0.5rem 0;
        }
        code { font-family: 'Fira Code', 'Consolas', monospace; font-size: 0.9rem; }
        .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
            color: var(--muted);
            font-size: 0.875rem;
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>${escapedTitle}</h1>
    <div class="meta">
        <div>Provider: ${escapeHtml(session.provider)} ${session.model ? `\u2022 Model: ${escapeHtml(session.model)}` : ""}</div>
        <div>Messages: ${session.messageCount} \u2022 Created: ${formatDate(session.createdAt)}</div>
    </div>
    <div class="messages">
        ${messageHtml}
    </div>
    <div class="footer">
        Exported from IronBridge on ${formatDate(/* @__PURE__ */ new Date())}
    </div>
</body>
</html>`;
  const filename = sanitizeFilename(`${session.title || "session"}-${session.id.slice(0, 8)}.html`);
  return {
    content: html,
    mimeType: "text/html",
    filename,
    blob: new Blob([html], { type: "text/html" })
  };
}
function exportToPdf(session, options = {}) {
  const htmlResult = exportToHtml(session, options);
  const printStyles = `
        <style media="print">
            body { background: white; color: black; padding: 1rem; }
            .message { background: #f5f5f5; border: 1px solid #ddd; }
            .message.user { background: #e3f2fd; }
            .message.assistant { background: #f5f5f5; }
            pre { background: #f0f0f0; }
            .role { color: #d32f2f; }
        </style>
    `;
  const content = htmlResult.content.replace("</head>", `${printStyles}</head>`);
  const filename = sanitizeFilename(`${session.title || "session"}-${session.id.slice(0, 8)}.pdf.html`);
  return {
    content,
    mimeType: "text/html",
    filename,
    blob: new Blob([content], { type: "text/html" })
  };
}
function exportSession(session, options) {
  switch (options.format) {
    case "json":
      return exportToJson(session, options);
    case "markdown":
      return exportToMarkdown(session, options);
    case "html":
      return exportToHtml(session, options);
    case "pdf":
      return exportToPdf(session, options);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}
function downloadExport(result) {
  const blob = result.blob || new Blob([result.content], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 200);
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function formatMessageContent(content) {
  return escapeHtml(content).replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>").replace(/`([^`]+)`/g, "<code>$1</code>");
}

// src/utils/index.ts
function formatDate(date, options) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }
  const defaultOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };
  return d.toLocaleString(void 0, options || defaultOptions);
}
function formatDateISO(date) {
  if (date == null) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}
function formatTime(date) {
  if (date == null) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit" });
}
function formatRelativeTime(date) {
  if (date == null) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const now = /* @__PURE__ */ new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1e3);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? "hour" : "hours"} ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffWeek < 4) return `${diffWeek} ${diffWeek === 1 ? "week" : "weeks"} ago`;
  if (diffMonth < 12) return `${diffMonth} ${diffMonth === 1 ? "month" : "months"} ago`;
  return `${diffYear} ${diffYear === 1 ? "year" : "years"} ago`;
}
function isToday(date) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const today = /* @__PURE__ */ new Date();
  return d.toDateString() === today.toDateString();
}
function isWithinDays(date, days) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const now = /* @__PURE__ */ new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1e3);
  return d >= cutoff;
}
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function generateShortId() {
  return generateUUID().split("-")[0];
}
function generateTimestampId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}
function truncate(str, maxLength, suffix = "...") {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
}
function slugify(str) {
  return str.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
function extractFirstLine(text, maxLength = 50) {
  const firstLine = text.split("\n")[0].trim();
  return truncate(firstLine, maxLength);
}
function stripMarkdown(text) {
  return text.replace(/```[\s\S]*?```/g, "").replace(/!\[.*?\]\(.+?\)/g, "").replace(/\[(.+?)\]\(.+?\)/g, "$1").replace(/#{1,6}\s?/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").replace(/^\s*[-*+]\s/gm, "").replace(/^\s*\d+\.\s/gm, "").replace(/^\s*>/gm, "").trim();
}
function formatNumber(num) {
  return num.toLocaleString();
}
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}
function formatDuration(ms) {
  if (ms < 1e3) return `${ms}ms`;
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
function formatTokens(tokens) {
  if (tokens < 1e3) return tokens.toString();
  if (tokens < 1e6) return `${(tokens / 1e3).toFixed(1)}K`;
  return `${(tokens / 1e6).toFixed(1)}M`;
}
function groupBy(array, keyFn) {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
}
function sortBy(array, keyFn, order = "asc") {
  return [...array].sort((a, b) => {
    const aKey = keyFn(a);
    const bKey = keyFn(b);
    let comparison;
    if (aKey instanceof Date && bKey instanceof Date) {
      comparison = aKey.getTime() - bKey.getTime();
    } else if (typeof aKey === "number" && typeof bKey === "number") {
      comparison = aKey - bKey;
    } else {
      comparison = String(aKey).localeCompare(String(bKey));
    }
    return order === "desc" ? -comparison : comparison;
  });
}
function uniqueBy(array, keyFn) {
  const seen = /* @__PURE__ */ new Set();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, deepClone(value)])
  );
}
function deepMerge(target, ...sources) {
  const result = { ...target };
  for (const source of sources) {
    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = result[key];
      if (sourceValue !== null && typeof sourceValue === "object" && !Array.isArray(sourceValue) && targetValue !== null && typeof targetValue === "object" && !Array.isArray(targetValue)) {
        result[key] = deepMerge(
          targetValue,
          sourceValue
        );
      } else if (sourceValue !== void 0) {
        result[key] = sourceValue;
      }
    }
  }
  return result;
}
function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}
function omit(obj, keys) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
function isValidJson(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function retry(fn, options = {}) {
  const { maxAttempts = 3, baseDelay = 1e3, maxDelay = 1e4, onRetry } = options;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delayMs = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        onRetry?.(attempt, lastError);
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}
function debounce(fn, wait) {
  let timeoutId = null;
  return function debounced(...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, wait);
  };
}
function throttle(fn, wait) {
  let lastCall = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - lastCall >= wait) {
      lastCall = now;
      fn(...args);
    }
  };
}
function getFileName(path) {
  return path.split(/[\\/]/).pop() || "";
}
function getDirectory(path) {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join("/");
}
function getExtension(path) {
  const fileName = getFileName(path);
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > 0 ? fileName.slice(dotIndex + 1) : "";
}
function normalizePath(path) {
  return path.replace(/\\/g, "/");
}
function extractSessionTitle(messages, maxLength = 50) {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (firstUserMessage) {
    return extractFirstLine(firstUserMessage.content, maxLength);
  }
  return "Untitled Session";
}
function estimateTokenCount(text) {
  return Math.ceil(text.length / 4);
}
function countTotalTokens(messages) {
  return messages.reduce((total, msg) => total + estimateTokenCount(msg.content), 0);
}
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function isColorDark(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.5;
}

export { capitalize, chunk, countTotalTokens, debounce, deepClone, deepMerge, delay, downloadExport, estimateTokenCount, exportSession, exportToHtml, exportToJson, exportToMarkdown, exportToPdf, extractFirstLine, extractSessionTitle, formatBytes, formatDate, formatDateISO, formatDuration, formatNumber, formatRelativeTime, formatTime, formatTokens, generateShortId, generateTimestampId, generateUUID, getDirectory, getExtension, getFileName, groupBy, hexToRgb, isColorDark, isToday, isValidJson, isValidUUID, isValidUrl, isWithinDays, normalizePath, omit, pick, retry, rgbToHex, safeJsonParse, slugify, sortBy, stripMarkdown, throttle, toTitleCase, truncate, uniqueBy };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map