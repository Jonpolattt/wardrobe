const { getDefaultConfig } = require('expo/metro-config');
// Expo automatically configures this pnpm workspace and native autolinking.
module.exports = getDefaultConfig(__dirname);
