const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Monorepo: workspace packages (@rabb/*) are TypeScript sources outside apps/mobile.
const workspaceRoot = path.resolve(__dirname, '../..');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')],
    unstable_enableSymlinks: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
