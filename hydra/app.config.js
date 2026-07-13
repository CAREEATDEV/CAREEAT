// Dynamic Expo config.
//
// The WidgetKit target + App Group are INCLUDED by default (paid Apple account
// QN65J7X695). Requirements before the first build:
//   • accept the updated Apple Developer Program license
//   • register the App Group  group.com.hydraapp.hydra  on developer.apple.com
//
// Build with the widget:
//   npx expo prebuild --clean --platform ios && npx expo run:ios
//
// Quick simulator run WITHOUT the widget (no App Group needed):
//   HYDRA_NO_WIDGET=1 npx expo prebuild --clean --platform ios && npx expo run:ios
//
// Override the team id if needed with  HYDRA_TEAM_ID=XXXXXXXXXX.
const DEFAULT_TEAM_ID = 'QN65J7X695';
const APP_GROUP = 'group.com.hydraapp.hydra';

module.exports = ({ config }) => {
  const teamId = process.env.HYDRA_TEAM_ID || DEFAULT_TEAM_ID;
  const withWidget = !process.env.HYDRA_NO_WIDGET;

  const plugins = (config.plugins || []).filter((p) => {
    const name = Array.isArray(p) ? p[0] : p;
    return name !== '@bacons/apple-targets';
  });

  const ios = { ...(config.ios || {}) };

  if (withWidget) {
    plugins.push(['@bacons/apple-targets', { appleTeamId: teamId }]);
    ios.entitlements = {
      'com.apple.security.application-groups': [APP_GROUP],
    };
  } else {
    delete ios.entitlements;
  }

  return { ...config, plugins, ios };
};
