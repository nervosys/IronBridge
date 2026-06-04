// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package for changes
config.watchFolders = [
    path.resolve(workspaceRoot, 'chasm-shared'),
];

// Resolve @csm/shared to the local package
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'chasm-shared', 'node_modules'),
];

// Add extra node_modules to look for
config.resolver.extraNodeModules = {
    '@csm/shared': path.resolve(workspaceRoot, 'chasm-shared'),
};

// Disable hierarchical lookup to avoid issues
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
