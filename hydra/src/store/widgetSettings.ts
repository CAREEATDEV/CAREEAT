// App-side widget preferences. These drive the in-app widget PREVIEW and a few
// app defaults (e.g. the default EAU container). They are mirrored into the App
// Group snapshot as an optional field — the native Swift decoder ignores unknown
// keys, so this stays backward compatible without touching HydraWidget.swift.

export type WidgetFormat = 'lock' | 'small' | 'medium';

export interface WidgetSettings {
  preferredFormat: WidgetFormat;
  showAlcoholOnMedium: boolean;
  defaultWaterMl: number; // contenant EAU par défaut (mL)
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  preferredFormat: 'lock',
  showAlcoholOnMedium: true,
  defaultWaterMl: 250,
};

export const WATER_CONTAINERS = [
  { label: 'VERRE', ml: 250 },
  { label: 'GRAND VERRE', ml: 330 },
  { label: 'BOUTEILLE', ml: 500 },
  { label: 'GOURDE', ml: 750 },
] as const;
