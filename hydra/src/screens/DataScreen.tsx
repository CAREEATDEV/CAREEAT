import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useHydration } from '../store/useHydration';
import { C, FONTS, RADIUS } from '../theme/colors';
import { dailyNeedMl, HydrationEvent } from '../engine/hydrationEngine';
import {
  dayDrinkStats,
  greenStreak,
  greenTimePctToday,
  isSameDay,
  lastNDaysWater,
} from '../util/stats';

function labelFor(e: HydrationEvent): { text: string; color: string } {
  switch (e.type) {
    case 'water':
      return { text: `EAU  ${e.volumeMl}ml`, color: C.segmentFull };
    case 'electrolytes':
      return { text: `ÉLECTROLYTES  ${e.volumeMl}ml`, color: C.segmentFull };
    case 'alcohol':
      return { text: `ALCOOL  ${e.volumeMl}ml / ${e.abv}%`, color: C.poison };
    case 'caffeine':
      return { text: `CAFÉINE  ${e.volumeMl}ml`, color: C.textDim };
    case 'sport':
      return {
        text: `SPORT ${e.intensity.toUpperCase()}  ${e.durationMin}min`,
        color: C.amber,
      };
    case 'profile':
      return { text: 'PROFIL modifié', color: C.textDim };
  }
}

function StatCard({
  value,
  unit,
  label,
  color = C.text,
}: {
  value: string;
  unit?: string;
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={[styles.cardValue, { color }]}>
        {value}
        {unit ? <Text style={styles.cardUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export function DataScreen() {
  const { events, profile, deleteEvent } = useHydration();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const goal = dailyNeedMl(profile);
  const today = useMemo(() => dayDrinkStats(events, now), [events, now]);
  const greenPct = useMemo(
    () => greenTimePctToday(events, now, profile),
    [events, now, profile]
  );
  const streak = useMemo(
    () => greenStreak(events, now, goal),
    [events, now, goal]
  );
  const bars = useMemo(() => lastNDaysWater(events, now, 7), [events, now]);
  const maxBar = Math.max(goal, ...bars.map((b) => b.waterMl), 1);

  const items = events.filter((e) => isSameDay(e.at, now)).reverse();

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.title}>DONNÉES</Text>

        <View style={styles.cardRow}>
          <StatCard
            value={(today.waterMl / 1000).toFixed(today.waterMl >= 1000 ? 2 : 1)}
            unit="L"
            label="BU AUJOURD'HUI"
            color={C.segmentFull}
          />
          <StatCard value={String(today.glasses)} label="VERRES" />
        </View>
        <View style={styles.cardRow}>
          <StatCard
            value={`${greenPct}`}
            unit="%"
            label="TEMPS DANS LE VERT"
            color={greenPct >= 60 ? C.segmentFull : C.amber}
          />
          <StatCard
            value={String(streak)}
            label="STREAK (JOURS)"
            color={streak > 0 ? C.segmentFull : C.textDim}
          />
        </View>

        <Text style={styles.section}>7 DERNIERS JOURS</Text>
        <View style={styles.chart}>
          {bars.map((b, i) => {
            const h = Math.max(2, (b.waterMl / maxBar) * 90);
            const reached = b.waterMl >= goal;
            const isToday = i === bars.length - 1;
            return (
              <View key={b.dayStart} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: h,
                        backgroundColor: reached
                          ? C.segmentFull
                          : b.waterMl > 0
                          ? C.amber
                          : C.segmentEmpty,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.barLabel,
                    isToday && { color: C.text, fontFamily: FONTS.monoBold },
                  ]}
                >
                  {b.label}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.chartHint}>
          Objectif {Math.round(goal)} mL/j · barre pleine = objectif atteint
        </Text>

        <Text style={styles.section}>JOURNÉE</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>Aucun événement aujourd'hui.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {items.map((item) => {
              const t = new Date(item.at);
              const hh = t.getHours().toString().padStart(2, '0');
              const mm = t.getMinutes().toString().padStart(2, '0');
              const { text, color } = labelFor(item);
              return (
                <View key={String(item.at) + item.type} style={styles.row}>
                  <Text style={styles.time}>
                    {hh}:{mm}
                  </Text>
                  <Text style={[styles.kind, { color }]}>{text}</Text>
                  <Pressable
                    onPress={() => deleteEvent(item.at)}
                    hitSlop={10}
                  >
                    <Text style={styles.del}>×</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: 4,
    marginBottom: 16,
  },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.lg,
    padding: 16,
  },
  cardValue: {
    color: C.text,
    fontFamily: FONTS.monoBold,
    fontSize: 30,
    letterSpacing: 1,
  },
  cardUnit: { fontFamily: FONTS.mono, fontSize: 14, color: C.textDim },
  cardLabel: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 6,
  },
  section: {
    color: C.textDim,
    fontFamily: FONTS.label,
    letterSpacing: 3,
    marginTop: 26,
    marginBottom: 12,
    fontSize: 11,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 118,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: 90, justifyContent: 'flex-end' },
  barFill: { width: 18, borderRadius: 4 },
  barLabel: { color: C.textDim, fontFamily: FONTS.mono, fontSize: 11 },
  chartHint: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    gap: 12,
  },
  time: { color: C.textDim, fontFamily: FONTS.mono },
  kind: { flex: 1, fontFamily: FONTS.label, letterSpacing: 2, fontSize: 12 },
  del: { color: C.red, fontSize: 22, paddingHorizontal: 8 },
  empty: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    textAlign: 'center',
    marginTop: 20,
  },
});
