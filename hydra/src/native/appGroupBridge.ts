import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { HydrationEvent, UserProfile } from '../engine/hydrationEngine';

// Snapshot format shared with the Swift widget. Any shape change requires
// bumping `version` and updating the Swift SharedSnapshot decoder in lockstep.
export interface SharedSnapshot {
  version: 2;
  updatedAt: number;
  events: HydrationEvent[];
  profile: UserProfile;
}

const APP_GROUP =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)
    ?.appGroupId ?? 'group.com.chipli.hydra';

type BridgeShape = {
  writeSnapshot(appGroup: string, json: string): Promise<void>;
  reloadWidget(): Promise<void>;
};

const noopBridge: BridgeShape = {
  async writeSnapshot() {},
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
