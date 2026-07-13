// Dynamic Expo config.
//
// By DEFAULT (no HYDRA_TEAM_ID env var) we EXCLUDE the native WidgetKit target
// and the App Group entitlement. This lets the app build & run in the iOS
// Simulator (or Expo Go) with a FREE Apple account and no Team ID — ideal for
// recording promo videos of the app itself.
//
// To include the lock-screen / home-screen widget (requires a paid Apple
// Developer account + an App Group registered on your account), run with:
//   HYDRA_TEAM_ID=XXXXXXXXXX npx expo prebuild --clean --platform ios
//
// The static values live in app.json; this file only toggles the widget.
module.exports = ({ config }) => {
  const teamId = process.env.HYDRA_TEAM_ID;

  const plugins = (config.plugins || []).filter((p) => {
    const name = Array.isArray(p) ? p[0] : p;
    return name !== '@bacons/apple-targets';
  });

  const ios = { ...(config.ios || {}) };

  if (teamId) {
    plugins.push(['@bacons/apple-targets', { appleTeamId: teamId }]);
    ios.entitlements = {
      'com.apple.security.application-groups': ['group.com.chipli.hydra'],
    };
  } else {
    // Free simulator build: no widget, no App Group entitlement.
    delete ios.entitlements;
  }

  return { ...config, plugins, ios };
};
