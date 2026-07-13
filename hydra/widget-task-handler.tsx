import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { HydraWidgetView } from './src/widget/HydraWidgetView';
import {
  AlcoholAction,
  buildWidgetModel,
  logAlcoholFromWidget,
  logWaterFromWidget,
  readPersistedSlice,
  WidgetVariant,
} from './src/widget/widgetModel';

function variantFor(widgetName: string): WidgetVariant {
  return widgetName === 'HydraMedium' ? 'medium' : 'small';
}

async function render(props: WidgetTaskHandlerProps) {
  const slice = await readPersistedSlice();
  const model = buildWidgetModel(slice);
  props.renderWidget(
    <HydraWidgetView variant={variantFor(props.widgetInfo.widgetName)} model={model} />
  );
}

// Single entry point registered in index.ts. Android calls this in a headless JS
// context for every widget lifecycle event (add / periodic update / click).
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      await render(props);
      break;

    case 'WIDGET_CLICK':
      if (props.clickAction === 'ADD_WATER') {
        await logWaterFromWidget();
      } else if (props.clickAction?.startsWith('ADD_ALC_')) {
        await logAlcoholFromWidget(props.clickAction as AlcoholAction);
      }
      await render(props);
      break;

    case 'WIDGET_DELETED':
    default:
      break;
  }
}
