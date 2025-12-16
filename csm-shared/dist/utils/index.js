'use strict';

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

exports.capitalize = capitalize;
exports.chunk = chunk;
exports.countTotalTokens = countTotalTokens;
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