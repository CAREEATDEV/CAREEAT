import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { C, FONTS, RADIUS } from '../theme/colors';
import {
  ActiveSportSession,
  formatSportRemaining,
  intensityLabel,
  SportDrainSummary,
} from '../util/sport';

interface Props {
  sessions: ActiveSportSession[];
  drain: SportDrainSummary;
}

export function SportActiveIndicator({ sessions, drain }: Props) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (sessions.length === 0) return;
    let mounted = true;
    let loop: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (!mounted || reduce) {
          pulse.setValue(1);
          return;
        }
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1,
              duration: 700,
              useNativeDriver: false,
            }),
            Animated.timing(pulse, {
              toValue: 0.35,
              duration: 700,
              useNativeDriver: false,
            }),
          ])
        );
        loop.start();
      })
      .catch(() => pulse.setValue(1));

    return () => {
      mounted = false;
      loop?.stop();
    };
  }, [sessions.length, pulse]);

  if (sessions.length === 0) return null;

  const primary = sessions[0];

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          borderColor: pulse.interpolate({
            inputRange: [0.35, 1],
            outputRange: ['rgba(237,239,242,0.35)', 'rgba(237,239,242,0.95)'],
          }),
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.pulseDot} />
        <Text style={styles.title}>SÉANCE EN COURS</Text>
        <Text style={styles.intensity}>{intensityLabel(primary.intensity)}</Text>
      </View>
      <Text style={styles.line}>
        −{Math.round(drain.sweatMlPerH)} mL/h sueur ·{' '}
        {formatSportRemaining(primary.remainingSec)} restantes
      </Text>
      <Text style={styles.lineDim}>
        drain {Math.round(drain.totalMlPerH)} mL/h total · ×
        {drain.factorVsRest.toFixed(1)} vs repos (
        {Math.round(drain.passiveMlPerH)} + {Math.round(drain.sweatMlPerH)})
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    backgroundColor: '#0d1016',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.text,
  },
  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 12,
    letterSpacing: 2,
    flex: 1,
  },
  intensity: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  line: {
    color: C.text,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  lineDim: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
});
