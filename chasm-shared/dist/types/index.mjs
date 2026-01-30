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

export { BUILTIN_TEMPLATES, BUILT_IN_TEMPLATES, CHUNKING_DEFAULTS, DEFAULT_INDEX_SETTINGS, DEFAULT_SEARCH_OPTIONS, DEFAULT_SHORTCUTS, DEFAULT_SUMMARIZATION_OPTIONS, DEFAULT_TAGS, DEFAULT_TEAM_PERMISSIONS, EMBEDDING_MODELS, HIGHLIGHT_COLORS, PERMISSION_HIERARCHY, PRESENCE_COLORS, SHORTCUT_CATEGORIES, SUBSCRIPTION_TIERS, SUMMARY_TYPE_CONFIG, SWE_PROJECT_TEMPLATES, TAG_COLORS, TEMPLATE_CATEGORIES, calculateCompressionRatio, chunkText, cosineSimilarity, estimateTokens, formatShortcut, getInitials, getUserColor, hasPermission, initialSelectionState, matchesShortcut, normalizeVector, parseKeyboardEvent, selectionReducer };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map