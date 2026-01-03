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

export { SWE_PROJECT_TEMPLATES };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map