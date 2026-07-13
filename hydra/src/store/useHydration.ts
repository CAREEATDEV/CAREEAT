import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_PROFILE,
  DEFAULT_PRESETS,
  DrinkPreset,
  HydrationEvent,
  remainingAbsorptionMl,
  SportIntensity,
  UserProfile,
} from '../engine/hydrationEngine';

export type LogResult = { ok: true } | { ok: false; reason: 'saturated'; remainingMl: number };
export type SportLogResult =
  | { ok: true }
  | { ok: false; reason: 'session_active'; remainingSec: number };
import {
  reloadWidgetTimelines,
  writeSharedSnapshot,
} from '../native/appGroupBridge';
import {
  DEFAULT_WIDGET_SETTINGS,
  WidgetSettings,
} from './widgetSettings';
import { rescheduleNotifications } from '../notifications/scheduler';
import { activeSportSessions } from '../util/sport';

interface HydraState {
  events: HydrationEvent[];
  profile: UserProfile;
  presets: DrinkPreset[];
  widget: WidgetSettings;
  hydrated: boolean;
  onboarded: boolean;
  completeOnboarding: (
    profilePatch: Partial<UserProfile>,
    widgetPatch: Partial<WidgetSettings>
  ) => Promise<void>;
  logPreset: (key: string) => Promise<LogResult>;
  logWater: (volumeMl: number) => Promise<LogResult>;
  logCustomDrink: (kind: 'water' | 'electrolytes' | 'alcohol' | 'caffeine', args: { volumeMl: number; abv?: number; caffeineMg?: number }) => Promise<void>;
  logSport: (durationMin: number, intensity: SportIntensity) => Promise<SportLogResult>;
  undo: () => Promise<void>;
  deleteEvent: (at: number) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  updateWidget: (patch: Partial<WidgetSettings>) => Promise<void>;
  refreshWidget: () => Promise<void>;
  _sync: () => Promise<void>;
}

export const useHydration = create<HydraState>()(
  persist(
    (set, get) => ({
      events: [],
      profile: DEFAULT_PROFILE,
      presets: DEFAULT_PRESETS,
      widget: DEFAULT_WIDGET_SETTINGS,
      hydrated: false,
      onboarded: false,

      // First-run setup: apply the collected profile + water container in one
      // shot (single profile event, single sync) and flip the onboarded flag.
      async completeOnboarding(profilePatch, widgetPatch) {
        const nextProfile = { ...get().profile, ...profilePatch };
        const evt: HydrationEvent = { type: 'profile', at: Date.now(), patch: profilePatch };
        set({
          profile: nextProfile,
          widget: { ...get().widget, ...widgetPatch },
          events: [...get().events, evt],
          onboarded: true,
        });
        await get()._sync();
      },

      async logPreset(key): Promise<LogResult> {
        const preset = get().presets.find((p) => p.key === key);
        if (!preset) return { ok: true };
        const at = Date.now();
        // Saturation guard: you can't drink faster than your body absorbs.
        // Block water/electrolytes when the rolling-hour capacity is used up.
        if (preset.kind === 'water' || preset.kind === 'electrolytes') {
          const remaining = remainingAbsorptionMl(get().events, at);
          if (remaining < 30) {
            return { ok: false, reason: 'saturated', remainingMl: remaining };
          }
        }
        let e: HydrationEvent;
        if (preset.kind === 'water') e = { type: 'water', at, volumeMl: preset.volumeMl };
        else if (preset.kind === 'electrolytes') e = { type: 'electrolytes', at, volumeMl: preset.volumeMl };
        else if (preset.kind === 'alcohol') e = { type: 'alcohol', at, volumeMl: preset.volumeMl, abv: preset.abv ?? 5 };
        else e = { type: 'caffeine', at, volumeMl: preset.volumeMl, caffeineMg: preset.caffeineMg };
        set({ events: [...get().events, e] });
        await get()._sync();
        return { ok: true };
      },

      async logWater(volumeMl): Promise<LogResult> {
        const at = Date.now();
        const remaining = remainingAbsorptionMl(get().events, at);
        if (remaining < 30) {
          return { ok: false, reason: 'saturated', remainingMl: remaining };
        }
        set({ events: [...get().events, { type: 'water', at, volumeMl }] });
        await get()._sync();
        return { ok: true };
      },

      async logCustomDrink(kind, args) {
        const at = Date.now();
        let e: HydrationEvent;
        if (kind === 'alcohol') e = { type: 'alcohol', at, volumeMl: args.volumeMl, abv: args.abv ?? 5 };
        else if (kind === 'caffeine') e = { type: 'caffeine', at, volumeMl: args.volumeMl, caffeineMg: args.caffeineMg };
        else if (kind === 'electrolytes') e = { type: 'electrolytes', at, volumeMl: args.volumeMl };
        else e = { type: 'water', at, volumeMl: args.volumeMl };
        set({ events: [...get().events, e] });
        await get()._sync();
      },

      async logSport(durationMin, intensity): Promise<SportLogResult> {
        const at = Date.now();
        const { events, profile } = get();
        const active = activeSportSessions(events, at, profile);
        if (active.length > 0) {
          return {
            ok: false,
            reason: 'session_active',
            remainingSec: active[0].remainingSec,
          };
        }
        set({
          events: [...events, { type: 'sport', at, durationMin, intensity }],
        });
        await get()._sync();
        return { ok: true };
      },

      async undo() {
        const evs = get().events;
        for (let i = evs.length - 1; i >= 0; i--) {
          if (evs[i].type !== 'profile') {
            set({ events: [...evs.slice(0, i), ...evs.slice(i + 1)] });
            await get()._sync();
            return;
          }
        }
      },

      async deleteEvent(at) {
        set({ events: get().events.filter((e) => e.at !== at) });
        await get()._sync();
      },

      async updateProfile(patch) {
        const next = { ...get().profile, ...patch };
        // Also log a profile-change event so historical recomputes remain
        // faithful (e.g. weight change kicks in from that timestamp).
        const evt: HydrationEvent = { type: 'profile', at: Date.now(), patch };
        set({ profile: next, events: [...get().events, evt] });
        await get()._sync();
      },

      async updateWidget(patch) {
        set({ widget: { ...get().widget, ...patch } });
        // Widget prefs live app-side; still push a fresh snapshot + reload so
        // the widget picks up any profile-driven values immediately.
        await get()._sync();
      },

      async refreshWidget() {
        await get()._sync();
      },

      async _sync() {
        const { events, profile, widget } = get();
        await writeSharedSnapshot({
          version: 2,
          updatedAt: Date.now(),
          events,
          profile,
          widget,
        });
        await reloadWidgetTimelines();
        await rescheduleNotifications(events, profile);
      },
    }),
    {
      name: 'hydra.v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        events: s.events,
        profile: s.profile,
        presets: s.presets,
        widget: s.widget,
        onboarded: s.onboarded,
      }),
      onRehydrateStorage: () => (state) => {
        state?._sync().catch(() => {});
        if (state) state.hydrated = true;
      },
    }
  )
);
