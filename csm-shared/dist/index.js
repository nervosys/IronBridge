'use strict';

// src/api/index.ts
var DEFAULT_CONFIG = {
  baseUrl: "http://localhost:8787",
  timeout: 3e4
};
function createApiClient(config = DEFAULT_CONFIG) {
  const { baseUrl, timeout = 3e4, headers = {}, onError, customFetch } = config;
  const fetchFn = customFetch || fetch;
  async function request(method, path, body, customHeaders) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
          ...customHeaders
        },
        body: body ? JSON.stringify(body) : void 0,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: errorData.message || response.statusText,
            details: errorData
          }
        };
      }
      const data = await response.json();
      if (data && typeof data === "object" && "success" in data) {
        return data;
      }
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);
      const err = error;
      if (onError) {
        onError(err);
      }
      return {
        success: false,
        error: {
          code: err.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
          message: err.message
        }
      };
    }
  }
  function buildQuery(params) {
    const entries = Object.entries(params).filter(([, v]) => v !== void 0);
    return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  }
  async function get(path, params) {
    const url = params ? `${path}?${buildQuery(params)}` : path;
    return request("GET", url);
  }
  async function post(path, body) {
    return request("POST", path, body);
  }
  async function put(path, body) {
    return request("PUT", path, body);
  }
  async function del(path) {
    return request("DELETE", path);
  }
  const workspaces = {
    async list(filter) {
      return get("/api/workspaces", filter);
    },
    async get(id) {
      return get(`/api/workspaces/${encodeURIComponent(id)}`);
    },
    async getByPath(path) {
      return get("/api/workspaces/by-path", { path });
    },
    async refresh(id) {
      return post(`/api/workspaces/${encodeURIComponent(id)}/refresh`);
    }
  };
  const sessions = {
    async list(filter) {
      return get("/api/sessions", filter);
    },
    async get(id) {
      return get(`/api/sessions/${encodeURIComponent(id)}`);
    },
    async getMessages(id) {
      return get(`/api/sessions/${encodeURIComponent(id)}`, { include: "messages" });
    },
    async create(data) {
      return post("/api/sessions", data);
    },
    async update(id, data) {
      return put(`/api/sessions/${encodeURIComponent(id)}`, data);
    },
    async delete(id) {
      return del(`/api/sessions/${encodeURIComponent(id)}`);
    },
    async archive(id, archived = true) {
      return post(`/api/sessions/${encodeURIComponent(id)}/archive`, { archived });
    },
    async fork(id, fromMessageId) {
      return post(`/api/sessions/${encodeURIComponent(id)}/fork`, { fromMessageId });
    },
    async merge(sessionIds, title) {
      return post("/api/sessions/merge", { sessionIds, title });
    }
  };
  const search = {
    async query(q, limit) {
      return get("/api/search", { q, limit });
    },
    async sessions(q, filter) {
      return get("/api/search/sessions", { q, ...filter });
    }
  };
  const stats = {
    async get() {
      return get("/api/stats");
    },
    async byProvider() {
      return get("/api/stats/by-provider");
    }
  };
  const mcp = {
    async listTools() {
      return get("/mcp/tools");
    },
    async callTool(name, args) {
      return post("/mcp/call", { name, arguments: args });
    },
    async callToolsBatch(calls) {
      return post("/mcp/call/batch", { calls });
    },
    async getSystemPrompt() {
      return get("/mcp/system-prompt");
    }
  };
  const health = {
    async check() {
      return get("/health");
    }
  };
  return {
    config: { baseUrl, timeout },
    workspaces,
    sessions,
    search,
    stats,
    mcp,
    health,
    // Expose raw request methods for custom endpoints
    request,
    get,
    post,
    put,
    delete: del
  };
}
var api = createApiClient();

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
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}
function formatTime(date) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return d.toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit" });
}
function formatRelativeTime(date) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
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
  return text.replace(/#{1,6}\s?/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").replace(/```[\s\S]*?```/g, "").replace(/\[(.+?)\]\(.+?\)/g, "$1").replace(/!\[.*?\]\(.+?\)/g, "").replace(/^\s*[-*+]\s/gm, "").replace(/^\s*\d+\.\s/gm, "").replace(/^\s*>/gm, "").trim();
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

// src/constants.ts
var PROVIDERS = {
  // =========================================================================
  // Cloud Providers
  // =========================================================================
  copilot: {
    id: "copilot",
    name: "GitHub Copilot",
    type: "cloud",
    models: ["gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet", "o1-preview", "o1-mini"],
    color: "#1f6feb",
    icon: "github"
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    type: "cloud",
    endpoint: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-preview", "o1-mini", "o3-mini"],
    color: "#10a37f",
    icon: "openai"
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    type: "cloud",
    endpoint: "https://api.anthropic.com/v1",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest", "claude-sonnet-4-20250514"],
    color: "#d4a574",
    icon: "anthropic"
  },
  azure: {
    id: "azure",
    name: "Azure OpenAI",
    type: "cloud",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    color: "#0078d4",
    icon: "azure"
  },
  google: {
    id: "google",
    name: "Google AI",
    type: "cloud",
    endpoint: "https://generativelanguage.googleapis.com/v1",
    models: ["gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    color: "#4285f4",
    icon: "google"
  },
  groq: {
    id: "groq",
    name: "Groq",
    type: "cloud",
    endpoint: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
    color: "#f55036",
    icon: "groq"
  },
  together: {
    id: "together",
    name: "Together AI",
    type: "cloud",
    endpoint: "https://api.together.xyz/v1",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-Coder-32B-Instruct", "deepseek-ai/DeepSeek-R1"],
    color: "#0ea5e9",
    icon: "together"
  },
  fireworks: {
    id: "fireworks",
    name: "Fireworks AI",
    type: "cloud",
    endpoint: "https://api.fireworks.ai/inference/v1",
    models: ["accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/qwen2p5-coder-32b-instruct"],
    color: "#ff6b35",
    icon: "fireworks"
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    type: "cloud",
    endpoint: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    color: "#4f46e5",
    icon: "deepseek"
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    type: "cloud",
    endpoint: "https://api.mistral.ai/v1",
    models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "codestral-latest"],
    color: "#ff7000",
    icon: "mistral"
  },
  cohere: {
    id: "cohere",
    name: "Cohere",
    type: "cloud",
    endpoint: "https://api.cohere.ai/v1",
    models: ["command-r-plus", "command-r", "command-light"],
    color: "#39594d",
    icon: "cohere"
  },
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    type: "cloud",
    endpoint: "https://api.perplexity.ai",
    models: ["llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-small-128k-online"],
    color: "#20b2aa",
    icon: "perplexity"
  },
  // =========================================================================
  // Local Providers
  // =========================================================================
  ollama: {
    id: "ollama",
    name: "Ollama",
    type: "local",
    endpoint: "http://localhost:11434",
    models: ["llama3.2", "llama3.1", "codellama", "mistral", "mixtral", "qwen2.5-coder", "deepseek-coder-v2", "phi3"],
    color: "#ffffff",
    icon: "ollama"
  },
  lmstudio: {
    id: "lmstudio",
    name: "LM Studio",
    type: "local",
    endpoint: "http://localhost:1234/v1",
    models: [],
    color: "#6366f1",
    icon: "lmstudio"
  },
  jan: {
    id: "jan",
    name: "Jan",
    type: "local",
    endpoint: "http://localhost:1337/v1",
    models: [],
    color: "#2563eb",
    icon: "jan"
  },
  gpt4all: {
    id: "gpt4all",
    name: "GPT4All",
    type: "local",
    endpoint: "http://localhost:4891/v1",
    models: [],
    color: "#22c55e",
    icon: "gpt4all"
  },
  localai: {
    id: "localai",
    name: "LocalAI",
    type: "local",
    endpoint: "http://localhost:8080/v1",
    models: [],
    color: "#14b8a6",
    icon: "localai"
  },
  llamafile: {
    id: "llamafile",
    name: "llamafile",
    type: "local",
    endpoint: "http://localhost:8080/v1",
    models: [],
    color: "#f97316",
    icon: "llamafile"
  },
  textgenwebui: {
    id: "textgenwebui",
    name: "Text Gen WebUI",
    type: "local",
    endpoint: "http://localhost:5000/v1",
    models: [],
    color: "#a855f7",
    icon: "textgenwebui"
  },
  vllm: {
    id: "vllm",
    name: "vLLM",
    type: "local",
    endpoint: "http://localhost:8000/v1",
    models: [],
    color: "#3b82f6",
    icon: "vllm"
  },
  koboldcpp: {
    id: "koboldcpp",
    name: "KoboldCpp",
    type: "local",
    endpoint: "http://localhost:5001/v1",
    models: [],
    color: "#eab308",
    icon: "koboldcpp"
  },
  tabbyml: {
    id: "tabbyml",
    name: "Tabby",
    type: "local",
    endpoint: "http://localhost:8080/v1",
    models: [],
    color: "#ec4899",
    icon: "tabbyml"
  },
  exo: {
    id: "exo",
    name: "Exo",
    type: "local",
    endpoint: "http://localhost:52415/v1",
    models: [],
    color: "#8b5cf6",
    icon: "exo"
  }
};
var AGENT_ROLES = {
  coordinator: {
    id: "coordinator",
    name: "Coordinator",
    description: "Orchestrates tasks and manages other agents",
    icon: "\u{1F3AF}",
    color: "#3b82f6",
    capabilities: ["planning", "delegation", "synthesis", "monitoring"]
  },
  researcher: {
    id: "researcher",
    name: "Researcher",
    description: "Gathers information and analyzes data",
    icon: "\u{1F50D}",
    color: "#10b981",
    capabilities: ["search", "analysis", "synthesis", "fact_checking"]
  },
  coder: {
    id: "coder",
    name: "Coder",
    description: "Writes, reviews, and debugs code",
    icon: "\u{1F4BB}",
    color: "#f59e0b",
    capabilities: ["code_generation", "code_review", "debugging", "refactoring"]
  },
  reviewer: {
    id: "reviewer",
    name: "Reviewer",
    description: "Reviews code and provides feedback",
    icon: "\u2705",
    color: "#8b5cf6",
    capabilities: ["code_review", "quality_assurance", "feedback", "validation"]
  },
  executor: {
    id: "executor",
    name: "Executor",
    description: "Executes tools and commands",
    icon: "\u26A1",
    color: "#ef4444",
    capabilities: ["tool_use", "command_execution", "automation", "api_calls"]
  },
  writer: {
    id: "writer",
    name: "Writer",
    description: "Creates and edits documentation",
    icon: "\u270D\uFE0F",
    color: "#ec4899",
    capabilities: ["documentation", "content_creation", "editing", "summarization"]
  },
  tester: {
    id: "tester",
    name: "Tester",
    description: "Creates and runs tests",
    icon: "\u{1F9EA}",
    color: "#06b6d4",
    capabilities: ["test_generation", "test_execution", "bug_finding", "coverage_analysis"]
  },
  household: {
    id: "household",
    name: "Household Agent",
    description: "Proactively monitors and solves household problems with permission",
    icon: "\u{1F3E0}",
    color: "#14b8a6",
    capabilities: [
      "smart_home_monitoring",
      "energy_optimization",
      "maintenance_scheduling",
      "grocery_management",
      "bill_tracking",
      "appliance_monitoring",
      "security_alerts",
      "package_tracking",
      "cleaning_scheduling",
      "meal_planning"
    ]
  },
  business: {
    id: "business",
    name: "Business Agent",
    description: "Proactively monitors and solves work/business problems with permission",
    icon: "\u{1F4BC}",
    color: "#8b5cf6",
    capabilities: [
      "calendar_optimization",
      "email_triage",
      "meeting_prep",
      "deadline_tracking",
      "expense_management",
      "report_generation",
      "competitor_monitoring",
      "lead_tracking",
      "project_health",
      "team_coordination"
    ]
  },
  custom: {
    id: "custom",
    name: "Custom",
    description: "Custom agent with user-defined capabilities",
    icon: "\u{1F527}",
    color: "#6b7280",
    capabilities: []
  }
};
var ORCHESTRATION_MODES = {
  single: {
    id: "single",
    name: "Single Agent",
    description: "Traditional single-agent response",
    icon: "\u{1F464}"
  },
  sequential: {
    id: "sequential",
    name: "Sequential",
    description: "Agents execute one after another, passing results forward",
    icon: "\u27A1\uFE0F"
  },
  parallel: {
    id: "parallel",
    name: "Parallel",
    description: "Multiple agents work simultaneously on subtasks",
    icon: "\u26A1"
  },
  loop: {
    id: "loop",
    name: "Loop",
    description: "Agent repeats until a condition is met",
    icon: "\u{1F501}"
  },
  hierarchical: {
    id: "hierarchical",
    name: "Hierarchical",
    description: "Lead agent delegates to specialized sub-agents",
    icon: "\u{1F3DB}\uFE0F"
  },
  swarm: {
    id: "swarm",
    name: "Swarm",
    description: "Multiple agents collaborate with a coordinator",
    icon: "\u{1F41D}"
  },
  debate: {
    id: "debate",
    name: "Debate",
    description: "Agents debate to reach the best solution",
    icon: "\u{1F4AC}"
  }
};
var TOOL_CATEGORIES = {
  code: {
    id: "code",
    name: "Code",
    description: "Code execution and development tools",
    icon: "\u{1F4BB}"
  },
  search: {
    id: "search",
    name: "Search",
    description: "Search and retrieval tools",
    icon: "\u{1F50D}"
  },
  file: {
    id: "file",
    name: "File",
    description: "File system operations",
    icon: "\u{1F4C1}"
  },
  web: {
    id: "web",
    name: "Web",
    description: "Web browsing and fetching",
    icon: "\u{1F310}"
  },
  analysis: {
    id: "analysis",
    name: "Analysis",
    description: "Code analysis and linting",
    icon: "\u{1F4CA}"
  },
  git: {
    id: "git",
    name: "Git",
    description: "Version control operations",
    icon: "\u{1F4E6}"
  },
  database: {
    id: "database",
    name: "Database",
    description: "Database operations",
    icon: "\u{1F5C3}\uFE0F"
  },
  custom: {
    id: "custom",
    name: "Custom",
    description: "Custom tools",
    icon: "\u{1F527}"
  }
};
var AGENT_STATUSES = ["idle", "thinking", "executing", "waiting", "completed", "failed", "paused"];
var TASK_STATUSES = ["pending", "in_progress", "completed", "failed", "cancelled"];
var SWARM_STATUSES = ["idle", "running", "paused", "completed", "failed"];
var PROVIDER_STATUSES = ["connected", "disconnected", "error", "unknown"];
var EXPORT_FORMATS = ["json", "markdown", "html", "csv", "pdf"];
var API_CONFIG = {
  defaultBaseUrl: "http://localhost:3000",
  defaultTimeout: 3e4,
  version: "v1"
};
var API_ENDPOINTS = {
  health: "/api/health",
  stats: "/api/v1/stats",
  workspaces: "/api/v1/workspaces",
  sessions: "/api/v1/sessions",
  messages: "/api/v1/messages",
  providers: "/api/v1/providers",
  agents: "/api/v1/agents",
  swarms: "/api/v1/swarms",
  runs: "/api/v1/runs",
  chat: "/api/v1/chat",
  search: "/api/v1/search",
  mcp: "/api/v1/mcp",
  export: "/api/v1/export",
  import: "/api/v1/import"
};
var SESSION_FORMAT = {
  version: 3,
  maxMessages: 1e3,
  maxTitleLength: 200,
  maxContentLength: 1e5
};
var LIMITS = {
  maxMessageLength: 1e5,
  maxSessionMessages: 1e3,
  maxSessionTitleLength: 200,
  maxAgentsPerSwarm: 10,
  maxIterations: 50,
  maxConcurrentAgents: 5,
  maxToolCalls: 100,
  maxFileSize: 10 * 1024 * 1024
  // 10MB
};
var DEFAULT_AGENT_CONFIG = {
  temperature: 0.7,
  maxTokens: 4096,
  autonomy: "medium",
  maxIterations: 10
};
var DEFAULT_AGENTS = [
  {
    name: "assistant",
    role: "custom",
    description: "General-purpose AI assistant with planning and reflection",
    instruction: "You are a helpful assistant that provides clear, accurate, and concise responses.",
    model: "gpt-4o",
    tools: [],
    temperature: 0.7,
    autonomy: "medium",
    maxIterations: 10
  },
  {
    name: "coder",
    role: "coder",
    description: "Expert software developer with autonomous coding capabilities",
    instruction: "You are an expert software developer. Plan your approach, write clean code, and test it.",
    model: "gpt-4o",
    tools: ["read_file", "create_file", "replace_string_in_file", "run_in_terminal", "get_errors"],
    temperature: 0.3,
    autonomy: "high",
    maxIterations: 15
  },
  {
    name: "researcher",
    role: "researcher",
    description: "Research specialist with deep analysis capabilities",
    instruction: "You are a research specialist. Analyze thoroughly and provide balanced perspectives.",
    model: "gpt-4o",
    tools: ["semantic_search", "fetch_webpage", "read_file"],
    temperature: 0.5,
    autonomy: "high",
    maxIterations: 12
  },
  {
    name: "reviewer",
    role: "reviewer",
    description: "Code review expert with detailed analysis",
    instruction: "You are a senior code reviewer. Review for correctness, security, and best practices.",
    model: "gpt-4o",
    tools: ["read_file", "grep_search", "get_errors"],
    temperature: 0.3,
    autonomy: "medium",
    maxIterations: 8
  },
  {
    name: "coordinator",
    role: "coordinator",
    description: "Multi-agent coordinator for complex tasks",
    instruction: "You are a coordinator that orchestrates multiple agents. Plan, delegate, and synthesize.",
    model: "gpt-4o",
    tools: ["semantic_search"],
    temperature: 0.4,
    autonomy: "high",
    maxIterations: 20
  },
  {
    name: "household",
    role: "household",
    description: "Proactive household management agent that monitors your home and solves problems",
    instruction: `You are a proactive Household Agent that helps users manage their home life efficiently.

Your responsibilities:
1. MONITOR: Continuously scan for household issues (bills due, maintenance needed, supplies running low)
2. DETECT: Identify problems before they become urgent
3. PROPOSE: Suggest solutions with clear cost/benefit analysis
4. EXECUTE: Take action ONLY after explicit user permission

Proactive behaviors:
- Track recurring bills and alert before due dates
- Monitor smart home devices for anomalies (energy spikes, device offline)
- Manage grocery lists based on consumption patterns
- Schedule maintenance reminders (HVAC filters, car service, etc.)
- Track package deliveries and alert on delays
- Optimize energy usage based on utility rates and patterns
- Coordinate cleaning and household tasks
- Manage home security alerts

PERMISSION PROTOCOL:
- Always explain what you detected and why action is needed
- Present options ranked by recommendation
- Wait for explicit "approved", "yes", or "do it" before taking action
- For financial actions, always require confirmation
- Log all actions taken for transparency`,
    model: "gpt-4o",
    tools: [
      "smart_home_control",
      "calendar_create",
      "send_notification",
      "grocery_add",
      "bill_pay",
      "package_track",
      "energy_monitor",
      "maintenance_schedule"
    ],
    temperature: 0.4,
    autonomy: "supervised",
    maxIterations: 15
  },
  {
    name: "business",
    role: "business",
    description: "Proactive business agent that monitors work and solves professional problems",
    instruction: `You are a proactive Business Agent that helps users excel in their professional life.

Your responsibilities:
1. MONITOR: Scan calendars, emails, projects, and deadlines continuously
2. DETECT: Identify risks, conflicts, and opportunities early
3. PROPOSE: Suggest optimizations with clear reasoning
4. EXECUTE: Take action ONLY after explicit user permission

Proactive behaviors:
- Analyze calendar for conflicts, back-to-back meetings, prep time gaps
- Triage incoming emails by urgency and required action
- Prepare briefing docs before important meetings
- Track project deadlines and flag risks early
- Monitor expense reports and flag anomalies
- Generate weekly/monthly reports automatically
- Track competitor news and industry trends
- Follow up on pending responses and action items
- Optimize meeting schedules for focus time
- Coordinate with team members on shared goals

PERMISSION PROTOCOL:
- Always explain what you detected and the business impact
- Present options with pros/cons
- Wait for explicit approval before:
  - Sending any communication
  - Scheduling or rescheduling meetings
  - Making financial decisions
  - Sharing information externally
- Maintain confidentiality of all business data
- Log all actions for audit trail`,
    model: "gpt-4o",
    tools: [
      "calendar_read",
      "calendar_create",
      "email_read",
      "email_draft",
      "slack_send",
      "document_create",
      "expense_submit",
      "project_track",
      "web_search",
      "competitor_monitor"
    ],
    temperature: 0.3,
    autonomy: "supervised",
    maxIterations: 20
  }
];
var SWARM_TEMPLATES = [
  {
    name: "Research Team",
    description: "A team focused on research and analysis tasks",
    roles: ["coordinator", "researcher", "researcher", "reviewer"]
  },
  {
    name: "Development Team",
    description: "A team for software development tasks",
    roles: ["coordinator", "coder", "reviewer", "tester"]
  },
  {
    name: "Documentation Team",
    description: "A team for creating and reviewing documentation",
    roles: ["coordinator", "writer", "reviewer"]
  },
  {
    name: "Code Review Team",
    description: "A team for thorough code reviews",
    roles: ["coordinator", "reviewer", "reviewer", "tester"]
  },
  {
    name: "Life Management Team",
    description: "Proactive agents for managing household and business tasks",
    roles: ["coordinator", "household", "business"]
  },
  {
    name: "Home Automation Team",
    description: "Smart home monitoring and optimization",
    roles: ["household", "executor"]
  },
  {
    name: "Executive Assistant Team",
    description: "Full business support with research and coordination",
    roles: ["business", "researcher", "writer", "coordinator"]
  }
];
var PROACTIVE_AGENT_CONFIG = {
  /** Permission levels for proactive actions */
  permissionLevels: {
    notify_only: {
      id: "notify_only",
      name: "Notify Only",
      description: "Agent can only send notifications, no actions taken",
      autoApprove: []
    },
    low_risk: {
      id: "low_risk",
      name: "Low Risk Auto-Approve",
      description: "Auto-approve notifications, reminders, and info gathering",
      autoApprove: ["send_notification", "calendar_read", "email_read", "web_search", "package_track"]
    },
    medium_risk: {
      id: "medium_risk",
      name: "Medium Risk Auto-Approve",
      description: "Also auto-approve scheduling and drafts (no sending)",
      autoApprove: ["send_notification", "calendar_read", "calendar_create", "email_read", "email_draft", "document_create", "web_search", "package_track"]
    },
    high_autonomy: {
      id: "high_autonomy",
      name: "High Autonomy",
      description: "Auto-approve most actions except financial and external communication",
      autoApprove: ["*"],
      requireApproval: ["bill_pay", "email_send", "slack_send", "expense_submit", "purchase"]
    }
  },
  /** Scanning intervals for proactive monitoring */
  scanIntervals: {
    realtime: { id: "realtime", name: "Real-time", intervalMs: 0, description: "Event-driven, instant response" },
    frequent: { id: "frequent", name: "Every 5 minutes", intervalMs: 5 * 60 * 1e3, description: "High priority items" },
    regular: { id: "regular", name: "Every 30 minutes", intervalMs: 30 * 60 * 1e3, description: "Standard monitoring" },
    hourly: { id: "hourly", name: "Hourly", intervalMs: 60 * 60 * 1e3, description: "Low priority background tasks" },
    daily: { id: "daily", name: "Daily", intervalMs: 24 * 60 * 60 * 1e3, description: "Daily digest and reports" }
  },
  /** Problem categories that agents can detect */
  problemCategories: {
    household: [
      "bill_due",
      "maintenance_needed",
      "supply_low",
      "energy_anomaly",
      "device_offline",
      "security_alert",
      "package_delayed",
      "appointment_reminder",
      "weather_alert",
      "subscription_renewal"
    ],
    business: [
      "calendar_conflict",
      "deadline_approaching",
      "email_urgent",
      "meeting_prep_needed",
      "follow_up_due",
      "expense_pending",
      "project_at_risk",
      "competitor_news",
      "team_blocker",
      "report_due"
    ]
  }
};
var MEMORY_CONFIG = {
  /** Available embedding models */
  embeddingModels: {
    minilm: {
      id: "minilm",
      name: "MiniLM-L6-v2",
      dimension: 384,
      provider: "local",
      description: "Fast local embeddings, good for most use cases"
    },
    mpnet: {
      id: "mpnet",
      name: "MPNet Base v2",
      dimension: 768,
      provider: "local",
      description: "Higher quality local embeddings"
    },
    openaiSmall: {
      id: "openai_small",
      name: "OpenAI text-embedding-3-small",
      dimension: 1536,
      provider: "openai",
      description: "Balanced cloud embeddings, good quality/cost ratio"
    },
    openaiLarge: {
      id: "openai_large",
      name: "OpenAI text-embedding-3-large",
      dimension: 3072,
      provider: "openai",
      description: "Highest quality OpenAI embeddings"
    },
    cohere: {
      id: "cohere",
      name: "Cohere embed-english-v3.0",
      dimension: 1024,
      provider: "cohere",
      description: "Cohere multilingual embeddings"
    },
    googleGecko: {
      id: "google_gecko",
      name: "Google text-embedding-004",
      dimension: 768,
      provider: "google",
      description: "Google Vertex AI embeddings"
    },
    voyage: {
      id: "voyage",
      name: "Voyage AI voyage-2",
      dimension: 1024,
      provider: "voyage",
      description: "High quality embeddings for code and text"
    }
  },
  /** Memory types with descriptions */
  memoryTypes: {
    short_term: {
      id: "short_term",
      name: "Short-term Memory",
      description: "Current conversation context, cleared after session",
      ttlMinutes: 60
    },
    long_term: {
      id: "long_term",
      name: "Long-term Memory",
      description: "Persistent facts, preferences, and learned information",
      ttlMinutes: null
    },
    episodic: {
      id: "episodic",
      name: "Episodic Memory",
      description: "Specific events and experiences with timestamps",
      ttlMinutes: null
    },
    semantic: {
      id: "semantic",
      name: "Semantic Memory",
      description: "Concepts, relationships, and general knowledge",
      ttlMinutes: null
    },
    procedural: {
      id: "procedural",
      name: "Procedural Memory",
      description: "How to do things, workflows, and processes",
      ttlMinutes: null
    },
    preference: {
      id: "preference",
      name: "User Preferences",
      description: "User settings, likes, dislikes, and habits",
      ttlMinutes: null
    },
    cache: {
      id: "cache",
      name: "Computation Cache",
      description: "Cached results for expensive operations",
      ttlMinutes: 30
    }
  },
  /** Chunking strategies for documents */
  chunkingStrategies: {
    fixed_size: {
      id: "fixed_size",
      name: "Fixed Size",
      description: "Split into fixed character chunks",
      defaultSize: 1e3
    },
    sentence: {
      id: "sentence",
      name: "Sentence",
      description: "Split on sentence boundaries",
      defaultSize: 512
    },
    paragraph: {
      id: "paragraph",
      name: "Paragraph",
      description: "Split on paragraph boundaries",
      defaultSize: 512
    },
    semantic: {
      id: "semantic",
      name: "Semantic",
      description: "Intelligent splitting respecting content structure",
      defaultSize: 512
    },
    code: {
      id: "code",
      name: "Code-aware",
      description: "Split on function/class boundaries",
      defaultSize: 1024
    }
  },
  /** Default configurations */
  defaults: {
    embeddingModel: "minilm",
    chunkSize: 512,
    chunkOverlap: 50,
    chunkingStrategy: "semantic",
    contextWindowTokens: 8192,
    cacheSize: 1e3,
    maxVectorStoreEntries: 1e5,
    retrievalLimit: 5,
    minRelevanceScore: 0.7,
    autoSummarize: true,
    summarizeThreshold: 20
  },
  /** Similarity metrics */
  similarityMetrics: {
    cosine: { id: "cosine", name: "Cosine Similarity", description: "Default, works well for most cases" },
    euclidean: { id: "euclidean", name: "Euclidean Distance", description: "L2 distance converted to similarity" },
    dot_product: { id: "dot_product", name: "Dot Product", description: "Fast, requires normalized vectors" },
    manhattan: { id: "manhattan", name: "Manhattan Distance", description: "L1 distance converted to similarity" }
  },
  /** RAG presets */
  ragPresets: {
    minimal: {
      id: "minimal",
      name: "Minimal RAG",
      description: "Light memory usage, good for simple assistants",
      config: {
        embeddingModel: "minilm",
        contextWindowTokens: 4096,
        retrievalLimit: 3,
        autoSummarize: false
      }
    },
    balanced: {
      id: "balanced",
      name: "Balanced RAG",
      description: "Good balance of quality and performance",
      config: {
        embeddingModel: "minilm",
        contextWindowTokens: 8192,
        retrievalLimit: 5,
        autoSummarize: true
      }
    },
    comprehensive: {
      id: "comprehensive",
      name: "Comprehensive RAG",
      description: "Full memory capabilities for power users",
      config: {
        embeddingModel: "openai_small",
        contextWindowTokens: 16384,
        retrievalLimit: 10,
        autoSummarize: true
      }
    },
    code_focused: {
      id: "code_focused",
      name: "Code-focused RAG",
      description: "Optimized for code documentation and retrieval",
      config: {
        embeddingModel: "voyage",
        contextWindowTokens: 8192,
        retrievalLimit: 8,
        chunkingStrategy: "code",
        autoSummarize: false
      }
    }
  }
};
var INTEGRATIONS = {
  // =========================================================================
  // Productivity
  // =========================================================================
  googleCalendar: {
    id: "google_calendar",
    name: "Google Calendar",
    category: "productivity",
    icon: "calendar",
    color: "#4285f4",
    capabilities: ["list_events", "create_event", "update_event", "delete_event", "get_free_busy"],
    authType: "oauth2"
  },
  outlook: {
    id: "outlook",
    name: "Microsoft Outlook",
    category: "productivity",
    icon: "mail",
    color: "#0078d4",
    capabilities: ["list_events", "create_event", "list_emails", "send_email", "read_email"],
    authType: "oauth2"
  },
  gmail: {
    id: "gmail",
    name: "Gmail",
    category: "productivity",
    icon: "mail",
    color: "#ea4335",
    capabilities: ["list_emails", "send_email", "read_email", "archive", "label", "search"],
    authType: "oauth2"
  },
  notion: {
    id: "notion",
    name: "Notion",
    category: "productivity",
    icon: "file-text",
    color: "#000000",
    capabilities: ["list_pages", "create_page", "update_page", "query_database", "search"],
    authType: "oauth2"
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidian",
    category: "productivity",
    icon: "gem",
    color: "#7c3aed",
    capabilities: ["list_notes", "create_note", "update_note", "search", "get_backlinks"],
    authType: "local"
  },
  todoist: {
    id: "todoist",
    name: "Todoist",
    category: "productivity",
    icon: "check-square",
    color: "#e44332",
    capabilities: ["list_tasks", "create_task", "complete_task", "update_task", "list_projects"],
    authType: "oauth2"
  },
  // =========================================================================
  // Communication
  // =========================================================================
  slack: {
    id: "slack",
    name: "Slack",
    category: "communication",
    icon: "message-square",
    color: "#4a154b",
    capabilities: ["send_message", "list_channels", "read_messages", "upload_file", "react"],
    authType: "oauth2"
  },
  discord: {
    id: "discord",
    name: "Discord",
    category: "communication",
    icon: "message-circle",
    color: "#5865f2",
    capabilities: ["send_message", "list_guilds", "list_channels", "read_messages"],
    authType: "bot_token"
  },
  teams: {
    id: "teams",
    name: "Microsoft Teams",
    category: "communication",
    icon: "users",
    color: "#6264a7",
    capabilities: ["send_message", "list_teams", "list_channels", "schedule_meeting"],
    authType: "oauth2"
  },
  telegram: {
    id: "telegram",
    name: "Telegram",
    category: "communication",
    icon: "send",
    color: "#0088cc",
    capabilities: ["send_message", "list_chats", "read_messages", "send_file"],
    authType: "bot_token"
  },
  // =========================================================================
  // Browser
  // =========================================================================
  chrome: {
    id: "chrome",
    name: "Google Chrome",
    category: "browser",
    icon: "globe",
    color: "#4285f4",
    capabilities: ["list_tabs", "open_url", "close_tab", "get_bookmarks", "get_history"],
    authType: "extension"
  },
  arc: {
    id: "arc",
    name: "Arc Browser",
    category: "browser",
    icon: "compass",
    color: "#fc5c65",
    capabilities: ["list_tabs", "list_spaces", "create_space", "pin_tab", "create_easel"],
    authType: "local"
  },
  // =========================================================================
  // Development
  // =========================================================================
  github: {
    id: "github",
    name: "GitHub",
    category: "development",
    icon: "github",
    color: "#171515",
    capabilities: ["list_repos", "create_issue", "create_pr", "review_pr", "search_code"],
    authType: "oauth2"
  },
  gitlab: {
    id: "gitlab",
    name: "GitLab",
    category: "development",
    icon: "gitlab",
    color: "#fc6d26",
    capabilities: ["list_projects", "create_issue", "create_mr", "pipelines"],
    authType: "oauth2"
  },
  linear: {
    id: "linear",
    name: "Linear",
    category: "development",
    icon: "layout",
    color: "#5e6ad2",
    capabilities: ["list_issues", "create_issue", "update_issue", "list_projects", "search"],
    authType: "oauth2"
  },
  docker: {
    id: "docker",
    name: "Docker",
    category: "development",
    icon: "box",
    color: "#2496ed",
    capabilities: ["list_containers", "start_container", "stop_container", "build_image", "logs"],
    authType: "local"
  },
  // =========================================================================
  // Smart Home
  // =========================================================================
  homeAssistant: {
    id: "home_assistant",
    name: "Home Assistant",
    category: "smart_home",
    icon: "home",
    color: "#41bdf5",
    capabilities: ["list_devices", "control_device", "run_scene", "run_automation", "get_state"],
    authType: "api_key"
  },
  hue: {
    id: "hue",
    name: "Philips Hue",
    category: "smart_home",
    icon: "sun",
    color: "#0065d3",
    capabilities: ["list_lights", "set_light", "list_scenes", "run_scene"],
    authType: "bridge"
  },
  nest: {
    id: "nest",
    name: "Google Nest",
    category: "smart_home",
    icon: "thermometer",
    color: "#00a5e5",
    capabilities: ["get_temperature", "set_temperature", "get_cameras", "get_doorbell"],
    authType: "oauth2"
  },
  // =========================================================================
  // Finance
  // =========================================================================
  plaid: {
    id: "plaid",
    name: "Plaid",
    category: "finance",
    icon: "credit-card",
    color: "#00d66e",
    capabilities: ["list_accounts", "get_transactions", "get_balance"],
    authType: "oauth2"
  },
  coinbase: {
    id: "coinbase",
    name: "Coinbase",
    category: "finance",
    icon: "dollar-sign",
    color: "#0052ff",
    capabilities: ["get_portfolio", "get_prices", "list_transactions"],
    authType: "oauth2"
  },
  // =========================================================================
  // Health
  // =========================================================================
  appleHealth: {
    id: "apple_health",
    name: "Apple Health",
    category: "health",
    icon: "heart",
    color: "#ff2d55",
    capabilities: ["get_steps", "get_heart_rate", "get_sleep", "get_workouts"],
    authType: "local"
  },
  oura: {
    id: "oura",
    name: "Oura Ring",
    category: "health",
    icon: "activity",
    color: "#1d1d1f",
    capabilities: ["get_sleep", "get_readiness", "get_activity", "get_heart_rate"],
    authType: "oauth2"
  },
  // =========================================================================
  // Media
  // =========================================================================
  spotify: {
    id: "spotify",
    name: "Spotify",
    category: "media",
    icon: "music",
    color: "#1db954",
    capabilities: ["get_playing", "play", "pause", "skip", "search", "add_to_playlist"],
    authType: "oauth2"
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    category: "media",
    icon: "youtube",
    color: "#ff0000",
    capabilities: ["search", "get_subscriptions", "get_playlist", "get_watch_later"],
    authType: "oauth2"
  },
  // =========================================================================
  // Travel
  // =========================================================================
  googleMaps: {
    id: "google_maps",
    name: "Google Maps",
    category: "travel",
    icon: "map-pin",
    color: "#4285f4",
    capabilities: ["search_places", "get_directions", "get_traffic", "get_distance"],
    authType: "api_key"
  },
  uber: {
    id: "uber",
    name: "Uber",
    category: "travel",
    icon: "car",
    color: "#000000",
    capabilities: ["request_ride", "get_estimate", "get_history"],
    authType: "oauth2"
  },
  // =========================================================================
  // Shopping
  // =========================================================================
  amazon: {
    id: "amazon",
    name: "Amazon",
    category: "shopping",
    icon: "shopping-cart",
    color: "#ff9900",
    capabilities: ["search_products", "get_orders", "track_package", "add_to_cart"],
    authType: "oauth2"
  },
  instacart: {
    id: "instacart",
    name: "Instacart",
    category: "shopping",
    icon: "shopping-bag",
    color: "#43b02a",
    capabilities: ["search_products", "add_to_cart", "checkout", "track_order"],
    authType: "oauth2"
  },
  // =========================================================================
  // System
  // =========================================================================
  shell: {
    id: "shell",
    name: "Shell",
    category: "system",
    icon: "terminal",
    color: "#4d4d4d",
    capabilities: ["run_command", "run_script", "get_environment"],
    authType: "local"
  },
  clipboard: {
    id: "clipboard",
    name: "Clipboard",
    category: "system",
    icon: "clipboard",
    color: "#6b7280",
    capabilities: ["get", "set", "get_history", "clear"],
    authType: "local"
  },
  filesystem: {
    id: "filesystem",
    name: "Filesystem",
    category: "system",
    icon: "folder",
    color: "#3b82f6",
    capabilities: ["read", "write", "list", "search", "watch"],
    authType: "local"
  },
  notifications: {
    id: "notifications",
    name: "System Notifications",
    category: "system",
    icon: "bell",
    color: "#ef4444",
    capabilities: ["notify", "schedule", "cancel"],
    authType: "local"
  }
};
var INTEGRATION_CATEGORIES = [
  "productivity",
  "communication",
  "browser",
  "development",
  "smart_home",
  "finance",
  "health",
  "media",
  "travel",
  "shopping",
  "system"
];
var HOOK_TRIGGERS = {
  // Time-based
  cron: { id: "cron", name: "Cron Schedule", category: "time" },
  interval: { id: "interval", name: "Interval", category: "time" },
  daily: { id: "daily", name: "Daily", category: "time" },
  weekly: { id: "weekly", name: "Weekly", category: "time" },
  monthly: { id: "monthly", name: "Monthly", category: "time" },
  // Event-based
  webhook: { id: "webhook", name: "Webhook", category: "event" },
  fileChange: { id: "file_change", name: "File Change", category: "event" },
  emailReceived: { id: "email_received", name: "Email Received", category: "event" },
  calendarEvent: { id: "calendar_event", name: "Calendar Event", category: "event" },
  gitPush: { id: "git_push", name: "Git Push", category: "event" },
  gitPr: { id: "git_pr", name: "Pull Request", category: "event" },
  appLaunch: { id: "app_launch", name: "App Launch", category: "event" },
  systemWake: { id: "system_wake", name: "System Wake", category: "event" },
  batteryLow: { id: "battery_low", name: "Battery Low", category: "event" },
  networkChange: { id: "network_change", name: "Network Change", category: "event" }
};
var HOOK_ACTIONS = {
  // Notifications
  sendNotification: { id: "send_notification", name: "Send Notification", category: "notification" },
  sendEmail: { id: "send_email", name: "Send Email", category: "notification" },
  sendSlack: { id: "send_slack", name: "Send Slack Message", category: "notification" },
  sendDiscord: { id: "send_discord", name: "Send Discord Message", category: "notification" },
  sendSms: { id: "send_sms", name: "Send SMS", category: "notification" },
  // Automation
  runCommand: { id: "run_command", name: "Run Command", category: "automation" },
  runScript: { id: "run_script", name: "Run Script", category: "automation" },
  callApi: { id: "call_api", name: "Call API", category: "automation" },
  createFile: { id: "create_file", name: "Create File", category: "automation" },
  moveFile: { id: "move_file", name: "Move File", category: "automation" },
  // Calendar
  createEvent: { id: "create_event", name: "Create Calendar Event", category: "calendar" },
  updateEvent: { id: "update_event", name: "Update Calendar Event", category: "calendar" },
  // Tasks
  createTask: { id: "create_task", name: "Create Task", category: "tasks" },
  completeTask: { id: "complete_task", name: "Complete Task", category: "tasks" },
  // Smart Home
  controlDevice: { id: "control_device", name: "Control Smart Device", category: "smart_home" },
  runScene: { id: "run_scene", name: "Run Scene", category: "smart_home" },
  // AI
  askAgent: { id: "ask_agent", name: "Ask AI Agent", category: "ai" },
  summarize: { id: "summarize", name: "Summarize Content", category: "ai" },
  translate: { id: "translate", name: "Translate", category: "ai" }
};

exports.AGENT_ROLES = AGENT_ROLES;
exports.AGENT_STATUSES = AGENT_STATUSES;
exports.API_CONFIG = API_CONFIG;
exports.API_ENDPOINTS = API_ENDPOINTS;
exports.DEFAULT_AGENTS = DEFAULT_AGENTS;
exports.DEFAULT_AGENT_CONFIG = DEFAULT_AGENT_CONFIG;
exports.EXPORT_FORMATS = EXPORT_FORMATS;
exports.HOOK_ACTIONS = HOOK_ACTIONS;
exports.HOOK_TRIGGERS = HOOK_TRIGGERS;
exports.INTEGRATIONS = INTEGRATIONS;
exports.INTEGRATION_CATEGORIES = INTEGRATION_CATEGORIES;
exports.LIMITS = LIMITS;
exports.MEMORY_CONFIG = MEMORY_CONFIG;
exports.ORCHESTRATION_MODES = ORCHESTRATION_MODES;
exports.PROACTIVE_AGENT_CONFIG = PROACTIVE_AGENT_CONFIG;
exports.PROVIDERS = PROVIDERS;
exports.PROVIDER_STATUSES = PROVIDER_STATUSES;
exports.SESSION_FORMAT = SESSION_FORMAT;
exports.SWARM_STATUSES = SWARM_STATUSES;
exports.SWARM_TEMPLATES = SWARM_TEMPLATES;
exports.TASK_STATUSES = TASK_STATUSES;
exports.TOOL_CATEGORIES = TOOL_CATEGORIES;
exports.api = api;
exports.capitalize = capitalize;
exports.chunk = chunk;
exports.countTotalTokens = countTotalTokens;
exports.createApiClient = createApiClient;
exports.debounce = debounce;
exports.deepClone = deepClone;
exports.deepMerge = deepMerge;
exports.delay = delay;
exports.estimateTokenCount = estimateTokenCount;
exports.extractFirstLine = extractFirstLine;
exports.extractSessionTitle = extractSessionTitle;
exports.formatBytes = formatBytes;
exports.formatDate = formatDate;
exports.formatDateISO = formatDateISO;
exports.formatDuration = formatDuration;
exports.formatNumber = formatNumber;
exports.formatRelativeTime = formatRelativeTime;
exports.formatTime = formatTime;
exports.formatTokens = formatTokens;
exports.generateShortId = generateShortId;
exports.generateTimestampId = generateTimestampId;
exports.generateUUID = generateUUID;
exports.getDirectory = getDirectory;
exports.getExtension = getExtension;
exports.getFileName = getFileName;
exports.groupBy = groupBy;
exports.hexToRgb = hexToRgb;
exports.isColorDark = isColorDark;
exports.isToday = isToday;
exports.isValidJson = isValidJson;
exports.isValidUUID = isValidUUID;
exports.isValidUrl = isValidUrl;
exports.isWithinDays = isWithinDays;
exports.normalizePath = normalizePath;
exports.omit = omit;
exports.pick = pick;
exports.retry = retry;
exports.rgbToHex = rgbToHex;
exports.safeJsonParse = safeJsonParse;
exports.slugify = slugify;
exports.sortBy = sortBy;
exports.stripMarkdown = stripMarkdown;
exports.throttle = throttle;
exports.toTitleCase = toTitleCase;
exports.truncate = truncate;
exports.uniqueBy = uniqueBy;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map