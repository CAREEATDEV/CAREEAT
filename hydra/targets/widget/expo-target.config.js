/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'HydraWidget',
  icon: '../../assets/icon.png',
  colors: {
    $accent: '#3EE07A',
    $widgetBackground: '#000000',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.hydraapp.hydra'],
  },
  deploymentTarget: '16.4',
};
