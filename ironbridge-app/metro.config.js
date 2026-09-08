// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package for changes
config.watchFolders = [
    path.resolve(workspaceRoot, 'ironbridge-shared'),
];

// Resolve @ironbridge/shared to the local package
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'ironbridge-shared', 'node_modules'),
];

// Add extra node_modules to look for
config.resolver.extraNodeModules = {
    '@ironbridge/shared': path.resolve(workspaceRoot, 'ironbridge-shared'),
};

// Disable hierarchical lookup to avoid issues
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
