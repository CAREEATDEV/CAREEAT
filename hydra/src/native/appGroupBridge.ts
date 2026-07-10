import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { HydrationEvent, EngineSettings } from '../engine/hydrationEngine';

// Mirror of the app state that the widget's Swift engine reads on every
// timeline refresh. Keep this shape stable — any change requires bumping the
// Swift decoder in HydrationEngine.swift in lockstep.
export interface SharedSnapshot {
  version: 1;
  updatedAt: number;
  events: HydrationEvent[];
  settings: EngineSettings;
}

const APP_GROUP =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)
    ?.appGroupId ?? 'group.com.chipli.hydra';

// The native module is created by the @bacons/apple-targets config plugin.
// It writes a JSON blob into the shared UserDefaults for the group.
type BridgeShape = {
  writeSnapshot(appGroup: string, json: string): Promise<void>;
  reloadWidget(): Promise<void>;
};

const noopBridge: BridgeShape = {
  async writeSnapshot() {
    /* dev/simulator without widget target: swallow */
  },
  async reloadWidget() {},
};

const nativeBridge: BridgeShape | undefined =
  (NativeModules as Record<string, BridgeShape | undefined>).HydraAppGroup;

const bridge: BridgeShape =
  Platform.OS === 'ios' && nativeBridge ? nativeBridge : noopBridge;

export async function writeSharedSnapshot(snap: SharedSnapshot): Promise<void> {
  await bridge.writeSnapshot(APP_GROUP, JSON.stringify(snap));
}

export async function reloadWidgetTimelines(): Promise<void> {
  await bridge.reloadWidget();
}
