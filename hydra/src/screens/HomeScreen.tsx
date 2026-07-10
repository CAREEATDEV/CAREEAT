import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { HydrationBar } from '../components/HydrationBar';
import { LogButton } from '../components/LogButton';
import { useHydration } from '../store/useHydration';
import { stateNow } from '../engine/hydrationEngine';
import { C, FONTS } from '../theme/colors';
import { computeGreenStreak, formatCountdown } from '../util/time';

export function HomeScreen() {
  const { events, settings, log, undo } = useHydration();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);
  const state = stateNow(events, settings);
  const streak = computeGreenStreak(events);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>HYDRA</Text>
        <Text style={styles.streak}>STREAK {streak}</Text>
      </View>
      <View style={styles.body}>
        <HydrationBar state={state} segments={20} height={56} />
        <View style={styles.countdownRow}>
          <Text style={styles.cdLabel}>ROUGE DANS</Text>
          <Text style={styles.cdVal}>{formatCountdown(state.redAt)}</Text>
        </View>
        <View style={styles.grid}>
          <LogButton label="EAU" sub={`+${settings.waterMl}ml`} color={C.segmentFull} onPress={() => log('water')} />
          <LogButton label="BIÈRE" sub="-8%" color={C.amber} onPress={() => log('beer')} />
        </View>
        <View style={styles.grid}>
          <LogButton label="VIN" sub="-6%" color={C.amber} onPress={() => log('wine')} />
          <LogButton label="SHOT" sub="-15%" color={C.red} onPress={() => log('shot')} />
        </View>
        <LogButton label="UNDO DERNIER LOG" color={C.textDim} onPress={() => undo()} />
      </View>
      <Text style={styles.hint}>TICK {tick}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  brand: { color: C.text, fontFamily: FONTS.display, fontSize: 28, letterSpacing: 6 },
  streak: { color: C.textDim, fontFamily: FONTS.mono, fontSize: 14 },
  body: { paddingHorizontal: 20, gap: 14 },
  countdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  cdLabel: { color: C.textDim, fontFamily: FONTS.label, letterSpacing: 2 },
  cdVal: { color: C.text, fontFamily: FONTS.monoBold, fontSize: 20 },
  grid: { flexDirection: 'row', gap: 12 },
  hint: { color: '#000', fontSize: 0 },
});
