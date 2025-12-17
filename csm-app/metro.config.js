const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package for changes
config.watchFolders = [
    path.resolve(workspaceRoot, 'csm-shared'),
];

// Resolve @csm/shared to the local package
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'csm-shared', 'node_modules'),
];

// Add extra node_modules to look for
config.resolver.extraNodeModules = {
    '@csm/shared': path.resolve(workspaceRoot, 'csm-shared'),
};

// Disable hierarchical lookup to avoid issues
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
