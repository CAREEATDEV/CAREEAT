import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { HydrationEvent, UserProfile } from '../engine/hydrationEngine';
import type { WidgetSettings } from '../store/widgetSettings';

// Snapshot format shared with the Swift widget. `version` stays 2: the Swift
// SharedSnapshot decoder reads version/updatedAt/events/profile and ignores
// unknown keys, so the optional `widget` field below is backward compatible and
// requires NO change to targets/widget/HydraWidget.swift.
export interface SharedSnapshot {
  version: 2;
  updatedAt: number;
  events: HydrationEvent[];
  profile: UserProfile;
  widget?: WidgetSettings;
}

const APP_GROUP =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)
    ?.appGroupId ?? 'group.com.shipply.hydraapp';

type BridgeShape = {
  writeSnapshot(appGroup: string, json: string): Promise<void>;
  readSnapshot(appGroup: string): Promise<string | null>;
  reloadWidget(): Promise<void>;
};

const noopBridge: BridgeShape = {
  async writeSnapshot() {},
  async readSnapshot() {
    return null;
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

// Read the snapshot the widget shares. Used to merge events the widget's
// buttons appended (via App Intents) while the app was in the background.
export async function readSharedSnapshot(): Promise<SharedSnapshot | null> {
  const raw = await bridge.readSnapshot(APP_GROUP);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SharedSnapshot;
  } catch {
    return null;
  }
}

export async function reloadWidgetTimelines(): Promise<void> {
  await bridge.reloadWidget();
}
