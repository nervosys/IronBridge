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

export { SUBSCRIPTION_TIERS, SWE_PROJECT_TEMPLATES };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map