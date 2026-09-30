const { withInfoPlist } = require('expo/config-plugins');

// Build-time configuration only. Development keeps Expo's local-network tools.
module.exports = function withReleasePermissions(config, { enabled = false } = {}) {
  if (!enabled) return config;
  return withInfoPlist(config, result => {
    result.modResults.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: false,
      NSAllowsLocalNetworking: false,
    };
    delete result.modResults.NSBonjourServices;
    delete result.modResults.NSLocalNetworkUsageDescription;
    return result;
  });
};
