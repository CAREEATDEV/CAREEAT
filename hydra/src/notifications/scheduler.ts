import * as Notifications from 'expo-notifications';
import {
  computeState,
  HydrationEvent,
  UserProfile,
} from '../engine/hydrationEngine';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function rescheduleNotifications(
  events: HydrationEvent[],
  profile: UserProfile
): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const state = computeState(events, Date.now(), profile);
    const nowMs = Date.now();
    if (state.ambleAt && state.ambleAt > nowMs) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'TU SÈCHES.',
          body: 'La barre a franchi la zone ambre. Bois maintenant.',
        },
        trigger: { date: new Date(state.ambleAt) },
      });
    }
    if (state.redAt && state.redAt > nowMs) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'CRITIQUE.',
          body: 'HYDRA passe en rouge. Verre. Tout de suite.',
        },
        trigger: { date: new Date(state.redAt) },
      });
    }
  } catch {
    // Simulator / permission denied: swallow.
  }
}

export async function ensurePermissions(): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}
