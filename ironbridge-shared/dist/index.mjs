// src/types/annotations.ts
var TAG_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Gray", value: "#6b7280" }
];
var HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Purple", value: "#ddd6fe" },
  { name: "Orange", value: "#fed7aa" }
];
var DEFAULT_TAGS = [
  { name: "Important", color: "#ef4444", description: "High priority sessions" },
  { name: "Review", color: "#f59e0b", description: "Sessions to review later" },
  { name: "Bug Fix", color: "#ec4899", description: "Bug fixing sessions" },
  { name: "Feature", color: "#22c55e", description: "Feature development" },
  { name: "Learning", color: "#3b82f6", description: "Learning and exploration" },
  { name: "Research", color: "#8b5cf6", description: "Research and investigation" },
  { name: "Documentation", color: "#06b6d4", description: "Documentation work" },
  { name: "Refactor", color: "#6366f1", description: "Code refactoring" }
];

// src/types/templates.ts
var TEMPLATE_CATEGORIES = [
  { id: "coding", name: "Coding", icon: "code", description: "Code generation and development" },
  { id: "debugging", name: "Debugging", icon: "bug", description: "Bug fixing and troubleshooting" },
  { id: "documentation", name: "Documentation", icon: "file-text", description: "Writing docs and comments" },
  { id: "analysis", name: "Analysis", icon: "bar-chart", description: "Code review and analysis" },
  { id: "research", name: "Research", icon: "search", description: "Research and exploration" },
  { id: "writing", name: "Writing", icon: "edit", description: "Content and copy writing" },
  { id: "learning", name: "Learning", icon: "book-open", description: "Learning and tutorials" },
  { id: "creative", name: "Creative", icon: "sparkles", description: "Brainstorming and ideation" },
  { id: "business", name: "Business", icon: "briefcase", description: "Business and planning" },
  { id: "custom", name: "Custom", icon: "settings", description: "Custom templates" }
];
var BUILTIN_TEMPLATES = [
  {
    name: "Code Review",
    description: "Review code for bugs, security issues, and best practices",
    category: "analysis",
    systemPrompt: "You are an expert code reviewer. Analyze the provided code for bugs, security vulnerabilities, performance issues, and adherence to best practices. Provide specific, actionable feedback.",
    suggestedQueries: [
      "Review this code for security issues",
      "What are the potential bugs in this code?",
      "How can I improve the performance of this code?",
      "Does this code follow best practices?"
    ],
    tags: ["review", "quality"],
    icon: "eye",
    color: "#3b82f6",
    isBuiltIn: true
  },
  {
    name: "Debug Helper",
    description: "Help debug issues and find root causes",
    category: "debugging",
    systemPrompt: "You are an expert debugger. Help identify the root cause of bugs and issues. Ask clarifying questions, suggest debugging strategies, and provide step-by-step troubleshooting guidance.",
    suggestedQueries: [
      "Help me debug this error",
      "Why is this returning undefined?",
      "What could cause this race condition?",
      "How do I trace this issue?"
    ],
    tags: ["debug", "troubleshoot"],
    icon: "bug",
    color: "#ef4444",
    isBuiltIn: true
  },
  {
    name: "Documentation Writer",
    description: "Generate documentation, comments, and README files",
    category: "documentation",
    systemPrompt: "You are a technical writer specializing in software documentation. Write clear, concise, and comprehensive documentation. Include examples where appropriate.",
    suggestedQueries: [
      "Write documentation for this function",
      "Generate a README for this project",
      "Add JSDoc comments to this code",
      "Explain how this API works"
    ],
    tags: ["docs", "readme"],
    icon: "file-text",
    color: "#22c55e",
    isBuiltIn: true
  },
  {
    name: "Refactoring Assistant",
    description: "Help refactor and improve code structure",
    category: "coding",
    systemPrompt: "You are a software architect specializing in code refactoring. Suggest ways to improve code structure, reduce complexity, and enhance maintainability while preserving functionality.",
    suggestedQueries: [
      "How can I refactor this to be more maintainable?",
      "Suggest a better design pattern for this",
      "Help me reduce the complexity of this function",
      "How can I make this code more testable?"
    ],
    tags: ["refactor", "clean-code"],
    icon: "refresh-cw",
    color: "#8b5cf6",
    isBuiltIn: true
  },
  {
    name: "Test Writer",
    description: "Generate unit tests and test cases",
    category: "coding",
    systemPrompt: "You are a testing expert. Generate comprehensive unit tests with good coverage. Include edge cases, error scenarios, and follow testing best practices.",
    suggestedQueries: [
      "Write unit tests for this function",
      "What edge cases should I test?",
      "Generate integration tests for this API",
      "Help me improve test coverage"
    ],
    tags: ["testing", "unit-tests"],
    icon: "check-circle",
    color: "#10b981",
    isBuiltIn: true
  },
  {
    name: "Learning Tutor",
    description: "Explain concepts and help learn new technologies",
    category: "learning",
    systemPrompt: "You are a patient and knowledgeable tutor. Explain concepts clearly, provide examples, and adapt your explanations to the learner's level. Encourage questions and provide resources for further learning.",
    suggestedQueries: [
      "Explain how async/await works",
      "What is the difference between X and Y?",
      "Help me understand this concept",
      "Give me a simple example of..."
    ],
    tags: ["learning", "tutorial"],
    icon: "book-open",
    color: "#f59e0b",
    isBuiltIn: true
  },
  {
    name: "API Designer",
    description: "Design and plan REST or GraphQL APIs",
    category: "analysis",
    systemPrompt: "You are an API architect. Help design clean, RESTful APIs with proper resource naming, HTTP methods, status codes, and documentation. Consider scalability, versioning, and developer experience.",
    suggestedQueries: [
      "Design an API for this feature",
      "What endpoints do I need for this?",
      "Review my API design",
      "How should I structure this GraphQL schema?"
    ],
    tags: ["api", "design"],
    icon: "globe",
    color: "#06b6d4",
    isBuiltIn: true
  },
  {
    name: "SQL Helper",
    description: "Write and optimize SQL queries",
    category: "coding",
    systemPrompt: "You are a database expert. Help write efficient SQL queries, design schemas, and optimize database performance. Explain query execution plans and suggest indexes when appropriate.",
    suggestedQueries: [
      "Write a SQL query to...",
      "How can I optimize this query?",
      "Design a schema for this data",
      "Explain this query execution plan"
    ],
    tags: ["sql", "database"],
    icon: "database",
    color: "#6366f1",
    isBuiltIn: true
  }
];

// src/types/shortcuts.ts
var SHORTCUT_CATEGORIES = [
  { id: "navigation", name: "Navigation", description: "Moving around the app" },
  { id: "session", name: "Session", description: "Session management" },
  { id: "editor", name: "Editor", description: "Text editing" },
  { id: "selection", name: "Selection", description: "Selecting items" },
  { id: "batch", name: "Batch", description: "Bulk operations" },
  { id: "view", name: "View", description: "Display options" },
  { id: "misc", name: "Miscellaneous", description: "Other actions" }
];
var DEFAULT_SHORTCUTS = [
  // Navigation
  { action: "nav.home", keys: ["Alt", "H"], description: "Go to Home", category: "navigation", isEnabled: true },
  { action: "nav.sessions", keys: ["Alt", "S"], description: "Go to Sessions", category: "navigation", isEnabled: true },
  { action: "nav.workspaces", keys: ["Alt", "W"], description: "Go to Workspaces", category: "navigation", isEnabled: true },
  { action: "nav.agents", keys: ["Alt", "A"], description: "Go to Agents", category: "navigation", isEnabled: true },
  { action: "nav.settings", keys: ["Alt", ","], description: "Open Settings", category: "navigation", isEnabled: true },
  { action: "nav.search", keys: ["Ctrl", "K"], description: "Focus Search", category: "navigation", isEnabled: true },
  { action: "nav.back", keys: ["Alt", "ArrowLeft"], description: "Go Back", category: "navigation", isEnabled: true },
  { action: "nav.forward", keys: ["Alt", "ArrowRight"], description: "Go Forward", category: "navigation", isEnabled: true },
  // Session
  { action: "session.new", keys: ["Ctrl", "N"], description: "New Session", category: "session", isEnabled: true },
  { action: "session.close", keys: ["Ctrl", "W"], description: "Close Session", category: "session", isEnabled: true },
  { action: "session.save", keys: ["Ctrl", "S"], description: "Save Session", category: "session", isEnabled: true },
  { action: "session.export", keys: ["Ctrl", "E"], description: "Export Session", category: "session", isEnabled: true },
  { action: "session.archive", keys: ["Ctrl", "Shift", "A"], description: "Archive Session", category: "session", isEnabled: true },
  { action: "session.delete", keys: ["Ctrl", "Backspace"], description: "Delete Session", category: "session", isEnabled: true },
  { action: "session.duplicate", keys: ["Ctrl", "D"], description: "Duplicate Session", category: "session", isEnabled: true },
  { action: "session.share", keys: ["Ctrl", "Shift", "S"], description: "Share Session", category: "session", isEnabled: true },
  { action: "session.nextMessage", keys: ["Ctrl", "ArrowDown"], description: "Next Message", category: "session", isEnabled: true },
  { action: "session.prevMessage", keys: ["Ctrl", "ArrowUp"], description: "Previous Message", category: "session", isEnabled: true },
  // Editor
  { action: "editor.focus", keys: ["Ctrl", "L"], description: "Focus Editor", category: "editor", isEnabled: true },
  { action: "editor.submit", keys: ["Ctrl", "Enter"], description: "Submit Message", category: "editor", isEnabled: true },
  { action: "editor.newLine", keys: ["Shift", "Enter"], description: "New Line", category: "editor", isEnabled: true },
  { action: "editor.clear", keys: ["Escape"], description: "Clear Editor", category: "editor", isEnabled: true },
  { action: "editor.undo", keys: ["Ctrl", "Z"], description: "Undo", category: "editor", isEnabled: true },
  { action: "editor.redo", keys: ["Ctrl", "Y"], description: "Redo", category: "editor", isEnabled: true },
  // Selection
  { action: "select.all", keys: ["Ctrl", "A"], description: "Select All", category: "selection", isEnabled: true },
  { action: "select.none", keys: ["Escape"], description: "Deselect All", category: "selection", isEnabled: true },
  { action: "select.invert", keys: ["Ctrl", "I"], description: "Invert Selection", category: "selection", isEnabled: true },
  // Batch
  { action: "batch.delete", keys: ["Ctrl", "Shift", "Backspace"], description: "Delete Selected", category: "batch", isEnabled: true },
  { action: "batch.archive", keys: ["Ctrl", "Shift", "A"], description: "Archive Selected", category: "batch", isEnabled: true },
  { action: "batch.export", keys: ["Ctrl", "Shift", "E"], description: "Export Selected", category: "batch", isEnabled: true },
  { action: "batch.tag", keys: ["Ctrl", "T"], description: "Tag Selected", category: "batch", isEnabled: true },
  // View
  { action: "view.toggleSidebar", keys: ["Ctrl", "B"], description: "Toggle Sidebar", category: "view", isEnabled: true },
  { action: "view.toggleTheme", keys: ["Ctrl", "Shift", "T"], description: "Toggle Theme", category: "view", isEnabled: true },
  { action: "view.zoomIn", keys: ["Ctrl", "="], description: "Zoom In", category: "view", isEnabled: true },
  { action: "view.zoomOut", keys: ["Ctrl", "-"], description: "Zoom Out", category: "view", isEnabled: true },
  { action: "view.resetZoom", keys: ["Ctrl", "0"], description: "Reset Zoom", category: "view", isEnabled: true },
  { action: "view.fullscreen", keys: ["F11"], description: "Fullscreen", category: "view", isEnabled: true },
  // Misc
  { action: "misc.help", keys: ["F1"], description: "Help", category: "misc", isEnabled: true },
  { action: "misc.shortcuts", keys: ["Ctrl", "/"], description: "Show Shortcuts", category: "misc", isEnabled: true },
  { action: "misc.commandPalette", keys: ["Ctrl", "Shift", "P"], description: "Command Palette", category: "misc", isEnabled: true },
  { action: "misc.quickSwitch", keys: ["Ctrl", "P"], description: "Quick Switch", category: "misc", isEnabled: true }
];
function formatShortcut(keys) {
  return keys.map((key) => {
    switch (key) {
      case "Ctrl":
        return "\u2303";
      case "Alt":
        return "\u2325";
      case "Shift":
        return "\u21E7";
      case "Cmd":
        return "\u2318";
      case "Enter":
        return "\u21B5";
      case "Backspace":
        return "\u232B";
      case "Escape":
        return "Esc";
      case "ArrowUp":
        return "\u2191";
      case "ArrowDown":
        return "\u2193";
      case "ArrowLeft":
        return "\u2190";
      case "ArrowRight":
        return "\u2192";
      default:
        return key;
    }
  }).join("");
}
function parseKeyboardEvent(event) {
  const keys = [];
  if (event.ctrlKey || event.metaKey) keys.push("Ctrl");
  if (event.altKey) keys.push("Alt");
  if (event.shiftKey) keys.push("Shift");
  if (event.key && !["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
    keys.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
  }
  return keys;
}
function matchesShortcut(event, shortcut) {
  const eventKeys = parseKeyboardEvent(event);
  if (eventKeys.length !== shortcut.keys.length) return false;
  return shortcut.keys.every((key) => eventKeys.includes(key));
}

// src/types/batch.ts
function selectionReducer(state, action) {
  switch (action.type) {
    case "select":
      return {
        ...state,
        selectedIds: /* @__PURE__ */ new Set([...state.selectedIds, action.id]),
        lastSelectedId: action.id,
        isAllSelected: false
      };
    case "deselect": {
      const newSelected = new Set(state.selectedIds);
      newSelected.delete(action.id);
      return {
        ...state,
        selectedIds: newSelected,
        isAllSelected: false
      };
    }
    case "toggle":
      if (state.selectedIds.has(action.id)) {
        return selectionReducer(state, { type: "deselect", id: action.id });
      }
      return selectionReducer(state, { type: "select", id: action.id });
    case "selectRange": {
      const fromIndex = action.allIds.indexOf(action.fromId);
      const toIndex = action.allIds.indexOf(action.toId);
      if (fromIndex === -1 || toIndex === -1) return state;
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const rangeIds = action.allIds.slice(start, end + 1);
      return {
        ...state,
        selectedIds: /* @__PURE__ */ new Set([...state.selectedIds, ...rangeIds]),
        lastSelectedId: action.toId,
        isAllSelected: false
      };
    }
    case "selectAll":
      return {
        ...state,
        selectedIds: new Set(action.ids),
        isAllSelected: true
      };
    case "deselectAll":
      return {
        ...state,
        selectedIds: /* @__PURE__ */ new Set(),
        lastSelectedId: void 0,
        isAllSelected: false
      };
    case "invertSelection": {
      const inverted = new Set(
        action.allIds.filter((id) => !state.selectedIds.has(id))
      );
      return {
        ...state,
        selectedIds: inverted,
        isAllSelected: false
      };
    }
    default:
      return state;
  }
}
var initialSelectionState = {
  selectedIds: /* @__PURE__ */ new Set(),
  selectionMode: "multiple",
  isAllSelected: false
};

// src/types/collaboration.ts
var DEFAULT_TEAM_PERMISSIONS = {
  owner: {
    canInvite: true,
    canRemoveMembers: true,
    canEditSettings: true,
    canDeleteWorkspace: true,
    canCreateSessions: true,
    canDeleteSessions: true,
    canShareExternally: true,
    canViewAuditLog: true
  },
  admin: {
    canInvite: true,
    canRemoveMembers: true,
    canEditSettings: true,
    canDeleteWorkspace: false,
    canCreateSessions: true,
    canDeleteSessions: true,
    canShareExternally: true,
    canViewAuditLog: true
  },
  member: {
    canInvite: false,
    canRemoveMembers: false,
    canEditSettings: false,
    canDeleteWorkspace: false,
    canCreateSessions: true,
    canDeleteSessions: false,
    canShareExternally: false,
    canViewAuditLog: false
  },
  viewer: {
    canInvite: false,
    canRemoveMembers: false,
    canEditSettings: false,
    canDeleteWorkspace: false,
    canCreateSessions: false,
    canDeleteSessions: false,
    canShareExternally: false,
    canViewAuditLog: false
  },
  guest: {
    canInvite: false,
    canRemoveMembers: false,
    canEditSettings: false,
    canDeleteWorkspace: false,
    canCreateSessions: false,
    canDeleteSessions: false,
    canShareExternally: false,
    canViewAuditLog: false
  }
};
var PERMISSION_HIERARCHY = ["view", "comment", "edit", "admin"];
function hasPermission(userPermission, requiredPermission) {
  const userIndex = PERMISSION_HIERARCHY.indexOf(userPermission);
  const requiredIndex = PERMISSION_HIERARCHY.indexOf(requiredPermission);
  return userIndex >= requiredIndex;
}
var PRESENCE_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Pink", value: "#ec4899" }
];
function getUserColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PRESENCE_COLORS.length;
  return PRESENCE_COLORS[index].value;
}
function getInitials(displayName) {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// src/types/summarization.ts
var DEFAULT_SUMMARIZATION_OPTIONS = {
  maxTokens: 1024,
  temperature: 0.3,
  topP: 0.9,
  includeCodeBlocks: true,
  includeToolCalls: true,
  includeFileChanges: true,
  chunkSize: 4e3,
  overlapSize: 200
};
var SUMMARY_TYPE_CONFIG = {
  brief: {
    maxTokens: 128,
    temperature: 0.2,
    description: "A concise 1-2 sentence overview"
  },
  standard: {
    maxTokens: 512,
    temperature: 0.3,
    description: "A paragraph-length summary with key points"
  },
  detailed: {
    maxTokens: 2048,
    temperature: 0.4,
    description: "Multi-section summary with code highlights"
  },
  technical: {
    maxTokens: 2048,
    temperature: 0.2,
    description: "Technical deep-dive with code and architecture"
  },
  executive: {
    maxTokens: 1024,
    temperature: 0.3,
    description: "High-level business-focused summary"
  }
};
var BUILT_IN_TEMPLATES = [
  { id: "changelog", name: "Changelog Entry", type: "technical" },
  { id: "standup", name: "Standup Update", type: "brief" },
  { id: "code-review", name: "Code Review Summary", type: "technical" },
  { id: "meeting-notes", name: "Meeting Notes", type: "detailed" },
  { id: "project-status", name: "Project Status Report", type: "executive" }
];
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
function calculateCompressionRatio(inputTokens, outputTokens) {
  if (inputTokens === 0) return 0;
  return Number(((inputTokens - outputTokens) / inputTokens).toFixed(3));
}

// src/types/search.ts
var EMBEDDING_MODELS = [
  // OpenAI
  {
    provider: "openai",
    model: "text-embedding-3-small",
    dimensions: 1536,
    maxTokens: 8191,
    description: "Fast, efficient embeddings",
    costPer1kTokens: 2e-5
  },
  {
    provider: "openai",
    model: "text-embedding-3-large",
    dimensions: 3072,
    maxTokens: 8191,
    description: "Highest quality embeddings",
    costPer1kTokens: 13e-5
  },
  // Azure
  {
    provider: "azure",
    model: "text-embedding-ada-002",
    dimensions: 1536,
    maxTokens: 8191,
    description: "Azure OpenAI embeddings"
  },
  // Cohere
  {
    provider: "cohere",
    model: "embed-english-v3.0",
    dimensions: 1024,
    maxTokens: 512,
    description: "High-quality English embeddings"
  },
  {
    provider: "cohere",
    model: "embed-multilingual-v3.0",
    dimensions: 1024,
    maxTokens: 512,
    description: "Multilingual embeddings"
  },
  // Local
  {
    provider: "local",
    model: "all-MiniLM-L6-v2",
    dimensions: 384,
    maxTokens: 256,
    description: "Fast local model for testing"
  },
  {
    provider: "local",
    model: "all-mpnet-base-v2",
    dimensions: 768,
    maxTokens: 384,
    description: "High-quality local model"
  },
  // Ollama
  {
    provider: "ollama",
    model: "nomic-embed-text",
    dimensions: 768,
    maxTokens: 8192,
    description: "Local embeddings via Ollama"
  },
  {
    provider: "ollama",
    model: "mxbai-embed-large",
    dimensions: 1024,
    maxTokens: 512,
    description: "High-quality Ollama embeddings"
  }
];
var DEFAULT_SEARCH_OPTIONS = {
  limit: 20,
  offset: 0,
  includeMetadata: true,
  includeContent: true,
  includeHighlights: true,
  rerank: false,
  rerankModel: "cohere-rerank-v3",
  hybridWeight: 0.7,
  groupBy: "none",
  deduplicate: true
};
var DEFAULT_INDEX_SETTINGS = {
  indexType: "hnsw",
  metric: "cosine",
  efConstruction: 200,
  efSearch: 50,
  m: 16
};
var CHUNKING_DEFAULTS = {
  chunkSize: 512,
  chunkOverlap: 50,
  minChunkSize: 100,
  separators: ["\n\n", "\n", ". ", " "]
};
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same dimensions");
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}
function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}
function chunkText(text, options = {}) {
  const {
    chunkSize = CHUNKING_DEFAULTS.chunkSize,
    overlap = CHUNKING_DEFAULTS.chunkOverlap,
    separators = CHUNKING_DEFAULTS.separators
  } = options;
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= chunkSize) {
      chunks.push(remaining.trim());
      break;
    }
    let splitIndex = chunkSize;
    for (const sep of separators) {
      const lastSep = remaining.lastIndexOf(sep, chunkSize);
      if (lastSep > chunkSize * 0.5) {
        splitIndex = lastSep + sep.length;
        break;
      }
    }
    chunks.push(remaining.substring(0, splitIndex).trim());
    const nextStart = Math.max(0, splitIndex - overlap);
    remaining = remaining.substring(nextStart);
  }
  return chunks.filter((c) => c.length >= CHUNKING_DEFAULTS.minChunkSize);
}

// src/types/tagging.ts
var TAG_COLOR_STYLES = {
  red: { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" },
  orange: { bg: "#FFEDD5", text: "#9A3412", border: "#FED7AA" },
  yellow: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  green: { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
  teal: { bg: "#CCFBF1", text: "#0F766E", border: "#99F6E4" },
  blue: { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" },
  indigo: { bg: "#E0E7FF", text: "#3730A3", border: "#C7D2FE" },
  purple: { bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE" },
  pink: { bg: "#FCE7F3", text: "#9D174D", border: "#FBCFE8" },
  gray: { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" }
};
var TAG_COLOR_STYLES_DARK = {
  red: { bg: "#7F1D1D", text: "#FCA5A5", border: "#991B1B" },
  orange: { bg: "#7C2D12", text: "#FDBA74", border: "#9A3412" },
  yellow: { bg: "#78350F", text: "#FCD34D", border: "#92400E" },
  green: { bg: "#064E3B", text: "#6EE7B7", border: "#065F46" },
  teal: { bg: "#134E4A", text: "#5EEAD4", border: "#0F766E" },
  blue: { bg: "#1E3A8A", text: "#93C5FD", border: "#1E40AF" },
  indigo: { bg: "#312E81", text: "#A5B4FC", border: "#3730A3" },
  purple: { bg: "#4C1D95", text: "#C4B5FD", border: "#5B21B6" },
  pink: { bg: "#831843", text: "#F9A8D4", border: "#9D174D" },
  gray: { bg: "#374151", text: "#D1D5DB", border: "#4B5563" }
};
var SYSTEM_TAGS = [
  { name: "Favorite", color: "yellow", icon: "\u2B50", isSystem: true },
  { name: "Important", color: "red", icon: "\u2757", isSystem: true },
  { name: "Todo", color: "blue", icon: "\u{1F4CB}", isSystem: true },
  { name: "Done", color: "green", icon: "\u2705", isSystem: true },
  { name: "Bug", color: "red", icon: "\u{1F41B}", isSystem: true },
  { name: "Feature", color: "purple", icon: "\u2728", isSystem: true },
  { name: "Question", color: "teal", icon: "\u2753", isSystem: true },
  { name: "Learning", color: "indigo", icon: "\u{1F4DA}", isSystem: true }
];
var DEFAULT_SMART_COLLECTIONS = [
  {
    name: "Recent",
    type: "recent",
    icon: "\u{1F550}",
    smartRules: {
      filters: {
        logic: "and",
        conditions: [
          { field: "updatedAt", operator: "greaterThan", value: "-7d" }
        ]
      },
      refreshInterval: 0
    }
  },
  {
    name: "Starred",
    type: "favorite",
    icon: "\u2B50",
    smartRules: {
      filters: {
        logic: "and",
        conditions: [{ field: "isStarred", operator: "equals", value: true }]
      },
      refreshInterval: 0
    }
  },
  {
    name: "Has Code",
    type: "smart",
    icon: "\u{1F4BB}",
    smartRules: {
      filters: {
        logic: "and",
        conditions: [{ field: "hasCode", operator: "equals", value: true }]
      },
      refreshInterval: 5
    }
  },
  {
    name: "Long Sessions",
    type: "smart",
    icon: "\u{1F4DD}",
    smartRules: {
      filters: {
        logic: "and",
        conditions: [{ field: "messageCount", operator: "greaterThan", value: 20 }]
      },
      refreshInterval: 5
    }
  }
];
function getTagColorStyles(color, isDarkMode) {
  return isDarkMode ? TAG_COLOR_STYLES_DARK[color] : TAG_COLOR_STYLES[color];
}
function buildTagPath(tag, allTags) {
  const path = [tag.name];
  let current = tag;
  while (current.parentId) {
    const parent = allTags.find((t) => t.id === current.parentId);
    if (!parent) break;
    path.unshift(parent.name);
    current = parent;
  }
  return path.join("/");
}
function buildFolderTree(folders, collections, parentId, depth = 0) {
  return folders.filter((f) => f.parentId === parentId).sort((a, b) => a.displayOrder - b.displayOrder).map((folder) => ({
    ...folder,
    children: buildFolderTree(folders, collections, folder.id, depth + 1),
    collections: collections.filter((c) => c.parentId === folder.id),
    sessionCount: 0,
    // Would be calculated from actual data
    path: "",
    // Would be built from hierarchy
    depth
  }));
}
function evaluateCondition(condition, sessionValue) {
  const { operator, value } = condition;
  switch (operator) {
    case "equals":
      return sessionValue === value;
    case "notEquals":
      return sessionValue !== value;
    case "contains":
      return String(sessionValue).toLowerCase().includes(String(value).toLowerCase());
    case "notContains":
      return !String(sessionValue).toLowerCase().includes(String(value).toLowerCase());
    case "startsWith":
      return String(sessionValue).toLowerCase().startsWith(String(value).toLowerCase());
    case "endsWith":
      return String(sessionValue).toLowerCase().endsWith(String(value).toLowerCase());
    case "greaterThan":
      return Number(sessionValue) > Number(value);
    case "lessThan":
      return Number(sessionValue) < Number(value);
    case "greaterOrEqual":
      return Number(sessionValue) >= Number(value);
    case "lessOrEqual":
      return Number(sessionValue) <= Number(value);
    case "between":
      if (Array.isArray(value) && value.length === 2) {
        const num = Number(sessionValue);
        const [min, max] = value;
        return num >= min && num <= max;
      }
      return false;
    case "in":
      return Array.isArray(value) && value.includes(sessionValue);
    case "notIn":
      return Array.isArray(value) && !value.includes(sessionValue);
    case "isEmpty":
      return sessionValue === null || sessionValue === void 0 || sessionValue === "";
    case "isNotEmpty":
      return sessionValue !== null && sessionValue !== void 0 && sessionValue !== "";
    case "matches":
      try {
        const regex = new RegExp(String(value), "i");
        return regex.test(String(sessionValue));
      } catch {
        return false;
      }
    default:
      return false;
  }
}
function generateTagId() {
  return `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function generateCollectionId() {
  return `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// src/types/index.ts
var SWE_PROJECT_TEMPLATES = [
  {
    id: "typescript-node",
    name: "TypeScript Node.js",
    description: "Node.js project with TypeScript",
    language: "typescript",
    framework: "node",
    defaultRules: [
      { rule: "Use strict TypeScript - no `any` types unless absolutely necessary", category: "style", priority: 1 },
      { rule: "All async functions must have proper error handling", category: "requirement", priority: 2 },
      { rule: "Use ESM imports, not CommonJS require()", category: "style", priority: 3 }
    ],
    defaultMemory: []
  },
  {
    id: "react-app",
    name: "React Application",
    description: "React frontend application",
    language: "typescript",
    framework: "react",
    defaultRules: [
      { rule: "Use functional components with hooks, not class components", category: "style", priority: 1 },
      { rule: "All components must have proper TypeScript props interfaces", category: "requirement", priority: 2 },
      { rule: "Use Tailwind CSS for styling, avoid inline styles", category: "style", priority: 3 }
    ],
    defaultMemory: []
  },
  {
    id: "rust-project",
    name: "Rust Project",
    description: "Rust application or library",
    language: "rust",
    defaultRules: [
      { rule: "Handle all Result and Option types explicitly - no unwrap() in production code", category: "constraint", priority: 1 },
      { rule: "Document all public functions and types with /// doc comments", category: "documentation", priority: 2 },
      { rule: "Run clippy and fix warnings before committing", category: "requirement", priority: 3 }
    ],
    defaultMemory: []
  },
  {
    id: "python-project",
    name: "Python Project",
    description: "Python application or library",
    language: "python",
    defaultRules: [
      { rule: "Use type hints for all function parameters and return values", category: "style", priority: 1 },
      { rule: "Follow PEP 8 style guide", category: "style", priority: 2 },
      { rule: "All functions must have docstrings", category: "documentation", priority: 3 }
    ],
    defaultMemory: []
  }
];
var SUBSCRIPTION_TIERS = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    features: [
      "Up to 10 workspaces",
      "Up to 100 sessions",
      "Local sync only",
      "Basic agent support"
    ],
    limits: {
      maxWorkspaces: 10,
      maxSessions: 100,
      maxAgents: 3,
      maxSwarms: 1,
      syncEnabled: true,
      realTimeSync: false,
      prioritySync: false,
      teamFeatures: false,
      apiAccess: false,
      customIntegrations: false
    }
  },
  {
    tier: "pro",
    name: "Pro",
    price: 9.99,
    yearlyPrice: 99.99,
    features: [
      "Up to 100 workspaces",
      "Unlimited sessions",
      "Real-time cloud sync",
      "Unlimited agents",
      "API access",
      "Priority support"
    ],
    limits: {
      maxWorkspaces: 100,
      maxSessions: -1,
      // Unlimited
      maxAgents: -1,
      maxSwarms: 10,
      syncEnabled: true,
      realTimeSync: true,
      prioritySync: false,
      teamFeatures: false,
      apiAccess: true,
      customIntegrations: false
    }
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    price: 29.99,
    yearlyPrice: 299.99,
    features: [
      "Unlimited workspaces",
      "Unlimited sessions",
      "Priority real-time sync",
      "Unlimited agents & swarms",
      "Team collaboration features",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee"
    ],
    limits: {
      maxWorkspaces: -1,
      maxSessions: -1,
      maxAgents: -1,
      maxSwarms: -1,
      syncEnabled: true,
      realTimeSync: true,
      prioritySync: true,
      teamFeatures: true,
      apiAccess: true,
      customIntegrations: true
    }
  }
];

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

// src/constants.ts
var PROVIDERS = {
  // =========================================================================
  // IDE/Editor Providers (file-based storage)
  // =========================================================================
  copilot: {
    id: "copilot",
    name: "GitHub Copilot",
    type: "local",
    models: ["gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet", "o1-preview", "o1-mini"],
    color: "#1f6feb",
    icon: "github"
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    type: "local",
    models: ["cursor-fast", "gpt-4o", "claude-3.5-sonnet"],
    color: "#00d4aa",
    icon: "cursor"
  },
  continuedev: {
    id: "continuedev",
    name: "Continue.dev",
    type: "local",
    models: [],
    color: "#ff6b6b",
    icon: "continue"
  },
  codexcli: {
    id: "codexcli",
    name: "Codex CLI",
    type: "local",
    models: ["codex"],
    color: "#10a37f",
    icon: "openai"
  },
  droidcli: {
    id: "droidcli",
    name: "Droid CLI",
    type: "local",
    models: [],
    color: "#6366f1",
    icon: "factory"
  },
  geminicli: {
    id: "geminicli",
    name: "Gemini CLI",
    type: "local",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
    color: "#4285f4",
    icon: "google"
  },
  // =========================================================================
  // Cloud Providers
  // =========================================================================
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
var VLM_MODELS = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    category: "vlm",
    contextLength: 128e3,
    description: "OpenAI's flagship multimodal model",
    releaseDate: "2024-05",
    capabilities: {
      category: "vlm",
      inputModalities: ["text", "image", "audio"],
      outputModalities: ["text"],
      supportsStreaming: true,
      supportsRealtime: true,
      maxImageSize: 20 * 1024 * 1024,
      maxAudioLength: 600,
      supportedImageFormats: ["png", "jpeg", "webp", "gif"],
      supportedVideoFormats: [],
      supportedAudioFormats: ["mp3", "wav", "ogg"]
    }
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    category: "vlm",
    contextLength: 128e3,
    description: "Smaller, faster version of GPT-4o",
    releaseDate: "2024-07",
    capabilities: {
      category: "vlm",
      inputModalities: ["text", "image"],
      outputModalities: ["text"],
      supportsStreaming: true,
      supportsRealtime: false,
      maxImageSize: 20 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg", "webp", "gif"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  },
  {
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    provider: "google",
    category: "valm",
    contextLength: 1e6,
    description: "Google's multimodal model with vision, audio, and video",
    releaseDate: "2024-12",
    capabilities: {
      category: "valm",
      inputModalities: ["text", "image", "video", "audio"],
      outputModalities: ["text", "audio"],
      supportsStreaming: true,
      supportsRealtime: true,
      maxImageSize: 20 * 1024 * 1024,
      maxVideoLength: 3600,
      maxAudioLength: 9.5 * 3600,
      supportedImageFormats: ["png", "jpeg", "webp", "gif"],
      supportedVideoFormats: ["mp4", "mpeg", "mov", "avi", "webm"],
      supportedAudioFormats: ["mp3", "wav", "ogg", "flac"]
    }
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    category: "vlm",
    contextLength: 2e6,
    description: "Long-context multimodal model",
    releaseDate: "2024-02",
    capabilities: {
      category: "vlm",
      inputModalities: ["text", "image", "video", "audio"],
      outputModalities: ["text"],
      supportsStreaming: true,
      supportsRealtime: false,
      maxImageSize: 20 * 1024 * 1024,
      maxVideoLength: 3600,
      maxAudioLength: 9.5 * 3600,
      supportedImageFormats: ["png", "jpeg", "webp", "gif"],
      supportedVideoFormats: ["mp4", "mpeg", "mov", "avi", "webm"],
      supportedAudioFormats: ["mp3", "wav", "ogg", "flac"]
    }
  },
  {
    id: "claude-3-5-sonnet-latest",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    category: "vlm",
    contextLength: 2e5,
    description: "Anthropic's vision model with strong reasoning",
    releaseDate: "2024-10",
    capabilities: {
      category: "vlm",
      inputModalities: ["text", "image"],
      outputModalities: ["text"],
      supportsStreaming: true,
      supportsRealtime: false,
      maxImageSize: 20 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg", "webp", "gif"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  },
  {
    id: "llava-v1.6",
    name: "LLaVA 1.6",
    provider: "ollama",
    category: "vlm",
    contextLength: 4096,
    description: "Open-source vision-language model",
    releaseDate: "2024-01",
    capabilities: {
      category: "vlm",
      inputModalities: ["text", "image"],
      outputModalities: ["text"],
      supportsStreaming: true,
      supportsRealtime: false,
      maxImageSize: 10 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg", "webp"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  },
  {
    id: "qwen2-vl",
    name: "Qwen2-VL",
    provider: "ollama",
    category: "vlm",
    contextLength: 32e3,
    description: "Alibaba's vision-language model",
    releaseDate: "2024-08",
    capabilities: {
      category: "vlm",
      inputModalities: ["text", "image", "video"],
      outputModalities: ["text"],
      supportsStreaming: true,
      supportsRealtime: false,
      maxImageSize: 20 * 1024 * 1024,
      maxVideoLength: 600,
      supportedImageFormats: ["png", "jpeg", "webp", "gif"],
      supportedVideoFormats: ["mp4", "webm"],
      supportedAudioFormats: []
    }
  },
  {
    id: "pixtral-12b",
    name: "Pixtral 12B",
    provider: "mistral",
    category: "vlm",
    contextLength: 128e3,
    description: "Mistral's vision-language model",
    releaseDate: "2024-09",
    capabilities: {
      category: "vlm",
      inputModalities: ["text", "image"],
      outputModalities: ["text"],
      supportsStreaming: true,
      supportsRealtime: false,
      maxImageSize: 20 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg", "webp", "gif"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  }
];
var VLA_MODELS = [
  {
    id: "rt-2",
    name: "RT-2",
    provider: "google",
    category: "vla",
    contextLength: 4096,
    description: "Google's Robotics Transformer 2 for vision-language-action",
    releaseDate: "2023-07",
    capabilities: {
      category: "vla",
      inputModalities: ["text", "image", "sensor"],
      outputModalities: ["text", "action"],
      supportsStreaming: false,
      supportsRealtime: true,
      maxImageSize: 10 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  },
  {
    id: "rt-x",
    name: "RT-X",
    provider: "google",
    category: "vla",
    contextLength: 4096,
    description: "Cross-robot transfer model from Open X-Embodiment",
    releaseDate: "2023-10",
    capabilities: {
      category: "vla",
      inputModalities: ["text", "image", "sensor"],
      outputModalities: ["text", "action"],
      supportsStreaming: false,
      supportsRealtime: true,
      maxImageSize: 10 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  },
  {
    id: "octo",
    name: "Octo",
    provider: "custom",
    category: "vla",
    contextLength: 4096,
    description: "Open-source generalist robot policy from Berkeley",
    releaseDate: "2024-05",
    capabilities: {
      category: "vla",
      inputModalities: ["text", "image", "sensor"],
      outputModalities: ["action"],
      supportsStreaming: false,
      supportsRealtime: true,
      maxImageSize: 10 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  },
  {
    id: "openvla",
    name: "OpenVLA",
    provider: "custom",
    category: "vla",
    contextLength: 4096,
    description: "Open-source VLA from Stanford/Berkeley",
    releaseDate: "2024-06",
    capabilities: {
      category: "vla",
      inputModalities: ["text", "image"],
      outputModalities: ["action"],
      supportsStreaming: false,
      supportsRealtime: true,
      maxImageSize: 10 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  },
  {
    id: "palm-e",
    name: "PaLM-E",
    provider: "google",
    category: "embodied",
    contextLength: 8192,
    description: "Embodied multimodal language model",
    releaseDate: "2023-03",
    capabilities: {
      category: "embodied",
      inputModalities: ["text", "image", "sensor", "point_cloud"],
      outputModalities: ["text", "action"],
      supportsStreaming: false,
      supportsRealtime: false,
      maxImageSize: 10 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  },
  {
    id: "gr-1",
    name: "GR-1",
    provider: "custom",
    category: "vla",
    contextLength: 4096,
    description: "Fourier Intelligence humanoid robot model",
    releaseDate: "2024-03",
    capabilities: {
      category: "vla",
      inputModalities: ["text", "image", "sensor"],
      outputModalities: ["action"],
      supportsStreaming: false,
      supportsRealtime: true,
      maxImageSize: 10 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  },
  {
    id: "pi-zero",
    name: "\u03C0\u2080 (Pi-Zero)",
    provider: "custom",
    category: "vla",
    contextLength: 8192,
    description: "Physical Intelligence foundation model for dexterous manipulation",
    releaseDate: "2024-10",
    capabilities: {
      category: "vla",
      inputModalities: ["text", "image", "sensor"],
      outputModalities: ["action"],
      supportsStreaming: false,
      supportsRealtime: true,
      maxImageSize: 10 * 1024 * 1024,
      supportedImageFormats: ["png", "jpeg"],
      supportedVideoFormats: [],
      supportedAudioFormats: []
    }
  }
];
var MULTIMODAL_MODELS = [...VLM_MODELS, ...VLA_MODELS];
var MODEL_CATEGORIES = {
  llm: {
    name: "Language Model",
    description: "Text-only models for chat and generation",
    icon: "\u{1F4AC}"
  },
  vlm: {
    name: "Vision-Language Model",
    description: "Models that understand images and text",
    icon: "\u{1F441}\uFE0F"
  },
  vla: {
    name: "Vision-Language-Action",
    description: "Robotics models that output actions",
    icon: "\u{1F916}"
  },
  alm: {
    name: "Audio-Language Model",
    description: "Models that understand speech and audio",
    icon: "\u{1F3A4}"
  },
  valm: {
    name: "Vision-Audio-Language",
    description: "Full multimodal with vision, audio, and text",
    icon: "\u{1F3AC}"
  },
  multimodal: {
    name: "Multimodal",
    description: "Generic multimodal model",
    icon: "\u{1F52E}"
  },
  embodied: {
    name: "Embodied AI",
    description: "Full embodied agent with world understanding",
    icon: "\u{1F9BE}"
  }
};
function getModelsByCategory(category) {
  return MULTIMODAL_MODELS.filter((m) => m.category === category);
}
function getVLMModels() {
  return MULTIMODAL_MODELS.filter(
    (m) => m.capabilities.inputModalities.includes("image") && (m.category === "vlm" || m.category === "valm" || m.category === "vla" || m.category === "embodied")
  );
}
function getVLAModels() {
  return MULTIMODAL_MODELS.filter(
    (m) => m.capabilities.outputModalities.includes("action") || m.category === "vla" || m.category === "embodied"
  );
}
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
var REMOTE_MONITOR_CONFIG = {
  /** Node status types */
  nodeStatuses: {
    online: { id: "online", name: "Online", color: "#22c55e", description: "Node is healthy and responding" },
    degraded: { id: "degraded", name: "Degraded", color: "#f59e0b", description: "Node is online but experiencing issues" },
    offline: { id: "offline", name: "Offline", color: "#ef4444", description: "Node is unreachable" },
    maintenance: { id: "maintenance", name: "Maintenance", color: "#3b82f6", description: "Node is in maintenance mode" },
    unknown: { id: "unknown", name: "Unknown", color: "#6b7280", description: "Node status is unknown" }
  },
  /** Task status types */
  taskStatuses: {
    queued: { id: "queued", name: "Queued", color: "#6b7280", description: "Task is waiting to start" },
    starting: { id: "starting", name: "Starting", color: "#8b5cf6", description: "Task is initializing" },
    running: { id: "running", name: "Running", color: "#3b82f6", description: "Task is actively executing" },
    paused: { id: "paused", name: "Paused", color: "#f59e0b", description: "Task is paused" },
    completed: { id: "completed", name: "Completed", color: "#22c55e", description: "Task finished successfully" },
    failed: { id: "failed", name: "Failed", color: "#ef4444", description: "Task failed with error" },
    cancelled: { id: "cancelled", name: "Cancelled", color: "#6b7280", description: "Task was cancelled" },
    timed_out: { id: "timed_out", name: "Timed Out", color: "#ef4444", description: "Task exceeded time limit" }
  },
  /** Task priority levels */
  taskPriorities: {
    low: { id: "low", name: "Low", value: 0, color: "#6b7280" },
    normal: { id: "normal", name: "Normal", value: 1, color: "#3b82f6" },
    high: { id: "high", name: "High", value: 2, color: "#f59e0b" },
    critical: { id: "critical", name: "Critical", value: 3, color: "#ef4444" }
  },
  /** Log levels */
  logLevels: {
    trace: { id: "trace", name: "Trace", color: "#6b7280" },
    debug: { id: "debug", name: "Debug", color: "#8b5cf6" },
    info: { id: "info", name: "Info", color: "#3b82f6" },
    warn: { id: "warn", name: "Warning", color: "#f59e0b" },
    error: { id: "error", name: "Error", color: "#ef4444" }
  },
  /** Remote event types */
  eventTypes: {
    node_online: { id: "node_online", name: "Node Online", icon: "server" },
    node_offline: { id: "node_offline", name: "Node Offline", icon: "server-off" },
    node_status_changed: { id: "node_status_changed", name: "Node Status Changed", icon: "activity" },
    node_heartbeat: { id: "node_heartbeat", name: "Node Heartbeat", icon: "heart-pulse" },
    task_created: { id: "task_created", name: "Task Created", icon: "plus-circle" },
    task_started: { id: "task_started", name: "Task Started", icon: "play" },
    task_progress: { id: "task_progress", name: "Task Progress", icon: "loader" },
    task_step_completed: { id: "task_step_completed", name: "Step Completed", icon: "check-circle" },
    task_completed: { id: "task_completed", name: "Task Completed", icon: "check-circle-2" },
    task_failed: { id: "task_failed", name: "Task Failed", icon: "x-circle" },
    task_cancelled: { id: "task_cancelled", name: "Task Cancelled", icon: "slash" },
    task_log: { id: "task_log", name: "Task Log", icon: "file-text" },
    agent_registered: { id: "agent_registered", name: "Agent Registered", icon: "user-plus" },
    agent_unregistered: { id: "agent_unregistered", name: "Agent Unregistered", icon: "user-minus" }
  },
  /** Default configuration */
  defaults: {
    bindAddress: "0.0.0.0",
    port: 9876,
    tlsEnabled: false,
    heartbeatIntervalSecs: 30,
    nodeTimeoutSecs: 90,
    maxLogEntries: 1e3,
    metricsEnabled: true
  },
  /** Artifact types */
  artifactTypes: {
    file: { id: "file", name: "File", icon: "file" },
    directory: { id: "directory", name: "Directory", icon: "folder" },
    url: { id: "url", name: "URL", icon: "link" },
    database: { id: "database", name: "Database", icon: "database" },
    model: { id: "model", name: "Model", icon: "brain" },
    report: { id: "report", name: "Report", icon: "file-chart" },
    log: { id: "log", name: "Log", icon: "scroll" }
  },
  /** Monitoring presets */
  presets: {
    development: {
      id: "development",
      name: "Development",
      description: "Local development with verbose logging",
      config: {
        port: 9876,
        heartbeatIntervalSecs: 10,
        nodeTimeoutSecs: 30,
        maxLogEntries: 5e3,
        metricsEnabled: true
      }
    },
    production: {
      id: "production",
      name: "Production",
      description: "Production deployment with TLS and authentication",
      config: {
        port: 443,
        tlsEnabled: true,
        heartbeatIntervalSecs: 30,
        nodeTimeoutSecs: 90,
        maxLogEntries: 1e3,
        metricsEnabled: true
      }
    },
    lightweight: {
      id: "lightweight",
      name: "Lightweight",
      description: "Minimal resource usage for constrained environments",
      config: {
        port: 9876,
        heartbeatIntervalSecs: 60,
        nodeTimeoutSecs: 180,
        maxLogEntries: 100,
        metricsEnabled: false
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

export { AGENT_ROLES, AGENT_STATUSES, API_CONFIG, BUILTIN_TEMPLATES, BUILT_IN_TEMPLATES, CHUNKING_DEFAULTS, DEFAULT_AGENTS, DEFAULT_AGENT_CONFIG, DEFAULT_INDEX_SETTINGS, DEFAULT_SEARCH_OPTIONS, DEFAULT_SHORTCUTS, DEFAULT_SMART_COLLECTIONS, DEFAULT_SUMMARIZATION_OPTIONS, DEFAULT_TAGS, DEFAULT_TEAM_PERMISSIONS, EMBEDDING_MODELS, EXPORT_FORMATS, HIGHLIGHT_COLORS, HOOK_ACTIONS, HOOK_TRIGGERS, INTEGRATIONS, INTEGRATION_CATEGORIES, LIMITS, MEMORY_CONFIG, MODEL_CATEGORIES, MULTIMODAL_MODELS, ORCHESTRATION_MODES, PERMISSION_HIERARCHY, PRESENCE_COLORS, PROACTIVE_AGENT_CONFIG, PROVIDERS, PROVIDER_STATUSES, REMOTE_MONITOR_CONFIG, SESSION_FORMAT, SHORTCUT_CATEGORIES, SUBSCRIPTION_TIERS, SUMMARY_TYPE_CONFIG, SWARM_STATUSES, SWARM_TEMPLATES, SWE_PROJECT_TEMPLATES, SYSTEM_TAGS, TAG_COLORS, TAG_COLOR_STYLES, TAG_COLOR_STYLES_DARK, TASK_STATUSES, TEMPLATE_CATEGORIES, TOOL_CATEGORIES, VLA_MODELS, VLM_MODELS, api, buildFolderTree, buildTagPath, calculateCompressionRatio, capitalize, chunk, chunkText, cosineSimilarity, countTotalTokens, createApiClient, debounce, deepClone, deepMerge, delay, downloadExport, estimateTokenCount, estimateTokens, evaluateCondition, exportSession, exportToHtml, exportToJson, exportToMarkdown, exportToPdf, extractFirstLine, extractSessionTitle, formatBytes, formatDate, formatDateISO, formatDuration, formatNumber, formatRelativeTime, formatShortcut, formatTime, formatTokens, generateCollectionId, generateShortId, generateTagId, generateTimestampId, generateUUID, getDirectory, getExtension, getFileName, getInitials, getModelsByCategory, getTagColorStyles, getUserColor, getVLAModels, getVLMModels, groupBy, hasPermission, hexToRgb, initialSelectionState, isColorDark, isToday, isValidJson, isValidUUID, isValidUrl, isWithinDays, matchesShortcut, normalizePath, normalizeVector, omit, parseKeyboardEvent, pick, retry, rgbToHex, safeJsonParse, selectionReducer, slugify, sortBy, stripMarkdown, throttle, toTitleCase, truncate, uniqueBy };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map