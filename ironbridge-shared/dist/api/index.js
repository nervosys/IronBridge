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
    }
    // No getByPath or refresh: `/api/workspaces/by-path` and
    // `/api/workspaces/{id}/refresh` are not routed, both answered 404,
    // and neither had a caller.
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
      return get("/api/sessions/search", { q, ...filter });
    }
  };
  const stats = {
    async get() {
      return get("/api/stats");
    },
    async byProvider() {
      return get("/api/stats/providers");
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

exports.api = api;
exports.createApiClient = createApiClient;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map