// Dynamic Expo config.
//
// The WidgetKit target + App Group are INCLUDED by default (paid Apple account
// QN65J7X695). Requirements before the first build:
//   • accept the updated Apple Developer Program license
//   • register the App Group  group.com.shipply.hydraapp  on developer.apple.com
//
// Build with the widget:
//   npx expo prebuild --clean --platform ios && npx expo run:ios
//
// Quick simulator run WITHOUT the widget (no App Group needed):
//   HYDRA_NO_WIDGET=1 npx expo prebuild --clean --platform ios && npx expo run:ios
//
// Override the team id if needed with  HYDRA_TEAM_ID=XXXXXXXXXX.
const DEFAULT_TEAM_ID = 'QN65J7X695';
const APP_GROUP = 'group.com.shipply.hydraapp';

// Supabase (HYDRA project). The publishable/anon key is safe to ship — every
// table is RLS-locked to auth.uid(). Overridable via EXPO_PUBLIC_* env vars.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zxrakxkiqfiinszavuqi.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_A51TxCrIYng_8fa5PtV_yw_TMNtjZAi';

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
    // Compile the HydraAppGroup native module into the main app so the JS bridge
    // can write the shared snapshot the widget reads.
    plugins.push(require('./plugins/withHydraAppGroup'));
    ios.entitlements = {
      'com.apple.security.application-groups': [APP_GROUP],
    };
  } else {
    delete ios.entitlements;
  }

  // Sign in with Apple needs the native capability in the build (harmless on
  // Android; the button is only shown on iOS when the module is available).
  plugins.push('expo-apple-authentication');

  const extra = {
    ...(config.extra || {}),
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  };

  // EAS reads extra.eas.build.experimental.ios.appExtensions to provision the
  // widget target. When HYDRA_NO_WIDGET=1 the @bacons/apple-targets plugin is
  // skipped, so HydraWidget never lands in project.pbxproj — strip the extension
  // entry or Configure Xcode project fails with "Could not find target
  // 'HydraWidget'".
  if (!withWidget && extra.eas?.build?.experimental?.ios) {
    const { appExtensions: _drop, ...iosExperimental } =
      extra.eas.build.experimental.ios;
    extra.eas = {
      ...extra.eas,
      build: {
        ...extra.eas.build,
        experimental: {
          ...extra.eas.build.experimental,
          ios: iosExperimental,
        },
      },
    };
  }

  return {
    ...config,
    plugins,
    ios,
    extra,
  };
};
