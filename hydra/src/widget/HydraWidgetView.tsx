import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { WidgetModel, WidgetVariant, WIDGET_SEGMENTS } from './widgetModel';

// Faithful port of the iOS widget design (HydraWidget.swift / WidgetMocks.tsx)
// onto react-native-android-widget primitives. Fonts are registered via the
// config plugin in app.json (fontFamily = ttf file base name).
const FONT_DISPLAY = 'ChakraPetch-Bold';
const FONT_LABEL = 'ChakraPetch-SemiBold';
const FONT_MONO = 'IBMPlexMono-Regular';

const BG = '#0b0e13';
const BORDER = '#20252e';
const SEG_EMPTY = '#1C2026';
const DIM = '#7C828C';
const WATER = '#3EE07A';
const AMBER = '#FFB020';
const RED = '#FF3B4A';

function Segments({
  filled,
  color,
  height,
}: {
  filled: number;
  color: string;
  height: number;
}) {
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        width: 'match_parent',
        height,
        flexGap: 3,
      }}
    >
      {Array.from({ length: WIDGET_SEGMENTS }).map((_, i) => (
        <FlexWidget
          key={i}
          style={{
            flex: 1,
            height: 'match_parent',
            borderRadius: 2,
            backgroundColor: i < filled ? (color as `#${string}`) : SEG_EMPTY,
          }}
        />
      ))}
    </FlexWidget>
  );
}

function WaterButton({ label }: { label: string }) {
  return (
    <FlexWidget
      clickAction="ADD_WATER"
      style={{
        width: 'match_parent',
        height: 'wrap_content',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(62, 224, 122, 0.4)',
        backgroundColor: 'rgba(62, 224, 122, 0.14)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TextWidget
        text={label}
        style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: WATER }}
      />
    </FlexWidget>
  );
}

function AlcoholButton({
  label,
  color,
  border,
  bg,
  action,
}: {
  label: string;
  color: string;
  border: `rgba(${number}, ${number}, ${number}, ${number})`;
  bg: `rgba(${number}, ${number}, ${number}, ${number})`;
  action: string;
}) {
  return (
    <FlexWidget
      clickAction={action}
      style={{
        flex: 1,
        height: 'wrap_content',
        paddingVertical: 8,
        paddingHorizontal: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TextWidget
        text={label}
        style={{ fontFamily: FONT_LABEL, fontSize: 10, color: color as `#${string}` }}
      />
    </FlexWidget>
  );
}

function SmallWidget({ model }: { model: WidgetModel }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: BG,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TextWidget
          text="HYDRA"
          style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: 2, color: DIM }}
        />
        <TextWidget text="💧" style={{ fontSize: 12 }} />
      </FlexWidget>
      <TextWidget
        text={`${model.pct}%`}
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 38,
          color: model.zoneColor as `#${string}`,
          marginTop: 6,
          marginBottom: 8,
        }}
      />
      <Segments filled={model.filledSegments} color={model.zoneColor} height={11} />
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <TextWidget
          text={model.statusLabel}
          style={{ fontFamily: FONT_DISPLAY, fontSize: 10, color: model.zoneColor as `#${string}` }}
        />
        <TextWidget
          text={model.countdownLabel}
          style={{ fontFamily: FONT_MONO, fontSize: 9, color: DIM }}
        />
      </FlexWidget>
      <FlexWidget style={{ height: 9, width: 'match_parent' }} />
      <WaterButton label={model.waterLabel} />
    </FlexWidget>
  );
}

function MediumWidget({ model }: { model: WidgetModel }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: BG,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
        flexGap: 9,
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          flexGap: 14,
          alignItems: 'center',
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'column',
            width: 92,
            borderRightWidth: 1,
            borderRightColor: '#1a1f28',
            paddingRight: 12,
          }}
        >
          <TextWidget
            text="HYDRA"
            style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: 2, color: DIM }}
          />
          <TextWidget
            text={`${model.pct}%`}
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 32,
              color: model.zoneColor as `#${string}`,
              marginTop: 3,
              marginBottom: 3,
            }}
          />
          <TextWidget
            text={model.statusLabel}
            style={{ fontFamily: FONT_DISPLAY, fontSize: 10, color: model.zoneColor as `#${string}` }}
          />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 7 }}>
          <FlexWidget
            style={{
              flexDirection: 'row',
              width: 'match_parent',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <TextWidget
              text={`besoin ${model.dailyNeedMl} mL`}
              style={{ fontFamily: FONT_MONO, fontSize: 9, color: DIM }}
            />
            <TextWidget
              text={model.countdownLabel}
              style={{ fontFamily: FONT_MONO, fontSize: 9, color: DIM }}
            />
          </FlexWidget>
          <Segments filled={model.filledSegments} color={model.zoneColor} height={12} />
        </FlexWidget>
      </FlexWidget>
      <WaterButton label={model.waterLabel} />
      {model.showAlcohol ? (
        <FlexWidget
          style={{
            flexDirection: 'row',
            width: 'match_parent',
            flexGap: 7,
          }}
        >
          <AlcoholButton
            label="LÉGER 2–8°"
            color={AMBER}
            border="rgba(255, 176, 32, 0.42)"
            bg="rgba(255, 176, 32, 0.13)"
            action="ADD_ALC_LIGHT"
          />
          <AlcoholButton
            label="MOYEN 9–22°"
            color={AMBER}
            border="rgba(255, 176, 32, 0.42)"
            bg="rgba(255, 176, 32, 0.13)"
            action="ADD_ALC_MED"
          />
          <AlcoholButton
            label="FORT 30–45°"
            color={RED}
            border="rgba(255, 59, 74, 0.42)"
            bg="rgba(255, 59, 74, 0.13)"
            action="ADD_ALC_STRONG"
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

export function HydraWidgetView({
  variant,
  model,
}: {
  variant: WidgetVariant;
  model: WidgetModel;
}) {
  return variant === 'medium' ? (
    <MediumWidget model={model} />
  ) : (
    <SmallWidget model={model} />
  );
}
