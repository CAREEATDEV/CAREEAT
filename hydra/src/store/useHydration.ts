import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_SETTINGS,
  EngineSettings,
  HydrationEvent,
  DrinkKind,
} from '../engine/hydrationEngine';
import {
  reloadWidgetTimelines,
  writeSharedSnapshot,
} from '../native/appGroupBridge';
import { rescheduleNotifications } from '../notifications/scheduler';

interface HydraState {
  events: HydrationEvent[];
  settings: EngineSettings;
  hydrated: boolean;
  log: (kind: DrinkKind) => Promise<void>;
  undo: () => Promise<void>;
  deleteEvent: (at: number) => Promise<void>;
  updateSettings: (patch: Partial<EngineSettings>) => Promise<void>;
  _sync: () => Promise<void>;
}

export const useHydration = create<HydraState>()(
  persist(
    (set, get) => ({
      events: [],
      settings: DEFAULT_SETTINGS,
      hydrated: false,
      async log(kind) {
        const at = Date.now();
        const e: HydrationEvent = { type: 'drink', kind, at };
        set({ events: [...get().events, e] });
        await get()._sync();
      },
      async undo() {
        const evs = get().events;
        // remove the last drink event (settings stay)
        for (let i = evs.length - 1; i >= 0; i--) {
          if (evs[i].type === 'drink') {
            const next = [...evs.slice(0, i), ...evs.slice(i + 1)];
            set({ events: next });
            await get()._sync();
            return;
          }
        }
      },
      async deleteEvent(at) {
        set({ events: get().events.filter((e) => e.at !== at) });
        await get()._sync();
      },
      async updateSettings(patch) {
        const next = { ...get().settings, ...patch };
        // Also push a settings event into the log so historical recomputes stay
        // accurate — the engine reads the latest settings event ≤ t.
        const evt: HydrationEvent = {
          type: 'settings',
          at: Date.now(),
          settings: patch,
        };
        set({ settings: next, events: [...get().events, evt] });
        await get()._sync();
      },
      async _sync() {
        const { events, settings } = get();
        await writeSharedSnapshot({
          version: 1,
          updatedAt: Date.now(),
          events,
          settings,
        });
        await reloadWidgetTimelines();
        await rescheduleNotifications(events, settings);
      },
    }),
    {
      name: 'hydra.v1',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?._sync().catch(() => {});
        if (state) state.hydrated = true;
      },
    }
  )
);
