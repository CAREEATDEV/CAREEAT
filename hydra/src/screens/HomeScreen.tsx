import React, { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HydrationBar } from '../components/HydrationBar';
import { LogButton } from '../components/LogButton';
import { useHydration } from '../store/useHydration';
import { stateNow } from '../engine/hydrationEngine';
import { C, FONTS } from '../theme/colors';
import { computeGreenStreak, formatCountdown } from '../util/time';

export function HomeScreen() {
  const { events, profile, presets, logPreset, logSport, undo } = useHydration();
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);
  const state = stateNow(events, profile);
  const streak = computeGreenStreak(events);

  const findPreset = (key: string) => presets.find((p) => p.key === key);

  const drink = async (key: string) => {
    const r = await logPreset(key);
    if (!r.ok && r.reason === 'saturated') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setToast('SATURÉ · ton corps ne peut pas absorber plus vite. Attends un peu.');
      setTimeout(() => setToast(null), 2800);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
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

          {toast ? <Text style={styles.toast}>{toast}</Text> : null}

          <View style={styles.grid}>
            <LogButton
              label="EAU"
              sub={`+${findPreset('water')?.volumeMl ?? 250}ml`}
              color={C.segmentFull}
              onPress={() => drink('water')}
            />
            <LogButton
              label="BOUTEILLE"
              sub={`+${findPreset('water_bottle')?.volumeMl ?? 500}ml`}
              color={C.segmentFull}
              onPress={() => drink('water_bottle')}
            />
          </View>

          <View style={styles.grid}>
            <LogButton
              label="ALCOOL LÉGER"
              sub="2–8°  bière, cidre"
              color={C.amber}
              onPress={() => drink('alcohol_light')}
            />
            <LogButton
              label="ALCOOL MOYEN"
              sub="9–22°  vin, cocktail"
              color={C.amber}
              onPress={() => drink('alcohol_medium')}
            />
          </View>

          <View style={styles.grid}>
            <LogButton
              label="ALCOOL FORT"
              sub="30–45°  spiritueux"
              color={C.red}
              onPress={() => drink('alcohol_strong')}
            />
            <LogButton
              label="ÉLECTROLYTES"
              sub="+500ml · rétention ×1.1"
              color={C.segmentFull}
              onPress={() => drink('electrolytes')}
            />
          </View>

          <View style={styles.grid}>
            <LogButton
              label="SPORT MODÉRÉ"
              sub="30 min"
              color={C.text}
              onPress={() => logSport(30, 'moderate')}
            />
            <LogButton
              label="SPORT INTENSE"
              sub="30 min"
              color={C.text}
              onPress={() => logSport(30, 'intense')}
            />
          </View>

          <LogButton
            label="UNDO DERNIER LOG"
            color={C.textDim}
            onPress={() => undo()}
          />

          <Text style={styles.footHint}>
            Besoin quotidien : {Math.round(state.dailyNeedMl)} mL (
            {profile.weightKg} kg × 32) · absorbé cette heure{' '}
            {Math.round(state.absorbedLastHourMl)}/{state.absorbCapMl} mL
          </Text>
        </View>
        <Text style={styles.hidden}>TICK {tick}</Text>
      </ScrollView>
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
  brand: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 28,
    letterSpacing: 6,
  },
  streak: { color: C.textDim, fontFamily: FONTS.mono, fontSize: 14 },
  body: { paddingHorizontal: 20, gap: 12 },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  cdLabel: {
    color: C.textDim,
    fontFamily: FONTS.label,
    letterSpacing: 2,
  },
  cdVal: { color: C.text, fontFamily: FONTS.monoBold, fontSize: 20 },
  grid: { flexDirection: 'row', gap: 12 },
  toast: {
    color: C.poison,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 6,
  },
  footHint: {
    marginTop: 16,
    textAlign: 'center',
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  hidden: { color: '#000', fontSize: 0 },
});
