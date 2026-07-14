// Expo config plugin: compiles the HydraAppGroup native module into the MAIN app
// target (never the widget extension). It copies the Swift/Obj-C sources into the
// generated iOS project and registers them in the app target's build phase so the
// JS bridge (src/native/appGroupBridge.ts) can write the shared snapshot into the
// App Group and reload the widget timelines.
//
// The sources live outside targets/ on purpose: @bacons/apple-targets treats
// targets/widget/ as a synchronized folder and would otherwise sweep this React
// Native module (which does `import React`) into the widget extension, where React
// is unavailable — that was the "Unable to resolve module dependency: 'React'"
// build failure.
const { withXcodeProject, withDangerousMod, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FILES = ['HydraAppGroupModule.swift', 'HydraAppGroup.m'];

const withHydraAppGroup = (config) => {
  // 1) Copy the native sources into ios/<projectName>/
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const srcDir = path.join(cfg.modRequest.projectRoot, 'modules', 'hydra-app-group', 'native');
      const destDir = path.join(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName);
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of FILES) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }
      return cfg;
    },
  ]);

  // 2) Add the sources to the main app target and make sure Swift is enabled.
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const groupName = cfg.modRequest.projectName;

    for (const file of FILES) {
      const already = Object.values(project.hash.project.objects.PBXFileReference || {}).some(
        (ref) =>
          ref && typeof ref === 'object' && ref.path && ref.path.replace(/"/g, '').endsWith(file)
      );
      if (!already) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
          filepath: `${groupName}/${file}`,
          groupName,
          project,
        });
      }
    }

    // Defensive: ensure every native target config can compile Swift. The RN
    // template usually sets SWIFT_VERSION already; this is a harmless no-op then.
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      const bs = entry && typeof entry === 'object' ? entry.buildSettings : undefined;
      if (bs && bs.PRODUCT_NAME && !bs.SWIFT_VERSION) {
        bs.SWIFT_VERSION = '5.0';
      }
    }

    return cfg;
  });

  return config;
};

module.exports = withHydraAppGroup;
