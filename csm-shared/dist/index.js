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
  copilot: {
    id: "copilot",
    name: "GitHub Copilot",
    type: "cloud",
    models: ["gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet", "o1-preview", "o1-mini"],
    color: "#1f6feb",
    icon: "github"
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    type: "local",
    endpoint: "http://localhost:11434",
    models: ["llama3.2", "llama3.1", "codellama", "mistral", "mixtral", "qwen2.5-coder", "deepseek-coder"],
    color: "#ffffff",
    icon: "ollama"
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    type: "cloud",
    endpoint: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-preview", "o1-mini"],
    color: "#10a37f",
    icon: "openai"
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    type: "cloud",
    endpoint: "https://api.anthropic.com/v1",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
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
    models: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
    color: "#4285f4",
    icon: "google"
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
  llamafile: {
    id: "llamafile",
    name: "llamafile",
    type: "local",
    endpoint: "http://localhost:8080/v1",
    models: [],
    color: "#f97316",
    icon: "llamafile"
  },
  gpt4all: {
    id: "gpt4all",
    name: "GPT4All",
    type: "local",
    endpoint: "http://localhost:4891/v1",
    models: [],
    color: "#22c55e",
    icon: "gpt4all"
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
  }
];

exports.AGENT_ROLES = AGENT_ROLES;
exports.AGENT_STATUSES = AGENT_STATUSES;
exports.API_CONFIG = API_CONFIG;
exports.API_ENDPOINTS = API_ENDPOINTS;
exports.DEFAULT_AGENTS = DEFAULT_AGENTS;
exports.DEFAULT_AGENT_CONFIG = DEFAULT_AGENT_CONFIG;
exports.EXPORT_FORMATS = EXPORT_FORMATS;
exports.LIMITS = LIMITS;
exports.ORCHESTRATION_MODES = ORCHESTRATION_MODES;
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