import React from 'react';
import { Platform } from 'react-native';
import type { HydrationEvent, UserProfile } from '../engine/hydrationEngine';
import type { WidgetSettings } from '../store/widgetSettings';
import { HydraWidgetView } from '../widget/HydraWidgetView';
import { buildWidgetModel, WidgetVariant } from '../widget/widgetModel';

// Push a fresh render to every Android home-screen widget after the app mutates
// state. No-op on iOS (handled by WidgetKit via the App Group snapshot).
const WIDGETS: { name: string; variant: WidgetVariant }[] = [
  { name: 'HydraSmall', variant: 'small' },
  { name: 'HydraMedium', variant: 'medium' },
];

export async function updateAndroidWidgets(
  events: HydrationEvent[],
  profile: UserProfile,
  widget: WidgetSettings
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget');
    const model = buildWidgetModel({ events, profile, widget });
    await Promise.all(
      WIDGETS.map(({ name, variant }) =>
        requestWidgetUpdate({
          widgetName: name,
          renderWidget: () =>
            React.createElement(HydraWidgetView, { variant, model }),
          widgetNotFound: () => {},
        })
      )
    );
  } catch {
    // widget lib unavailable or no widgets added; ignore
  }
}
