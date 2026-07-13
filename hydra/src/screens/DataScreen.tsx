import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHydration } from '../store/useHydration';
import { C, FONTS, RADIUS } from '../theme/colors';
import { InfoTip } from '../components/InfoTip';
import { vagueHint } from '../content/metricHints';
import { dailyNeedMl, HydrationEvent } from '../engine/hydrationEngine';
import {
  consumptionRecap,
  dayDrinkStats,
  greenStreak,
  greenTimePctToday,
  isSameDay,
  lastNDaysPoisoned,
  lastNDaysWater,
  lifetimeTotals,
  poisonedMsThisWeek,
  poisonFreeStreak,
} from '../util/stats';

// "2 h 05" / "45 min" / "0" — compact poisoned-time label.
function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin <= 0) return '0';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

// "15 janv. 2026" — short French date for the lifetime "since" line.
function formatSince(ms: number): string {
  return new Date(ms).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
  hintTitle,
  hintBody,
}: {
  value: string;
  unit?: string;
  label: string;
  color?: string;
  hintTitle?: string;
  hintBody?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={[styles.cardValue, { color }]}>
        {value}
        {unit ? <Text style={styles.cardUnit}> {unit}</Text> : null}
      </Text>
      <View style={styles.cardLabelRow}>
        <Text style={styles.cardLabel}>{label}</Text>
        {hintTitle && hintBody ? (
          <InfoTip
            title={hintTitle}
            body={hintBody}
            accessibilityLabel={`Détails : ${label}`}
          />
        ) : null}
      </View>
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
  const streakHint = vagueHint(goal);
  const bars = useMemo(() => lastNDaysWater(events, now, 7), [events, now]);
  const maxBar = Math.max(goal, ...bars.map((b) => b.waterMl), 1);

  const poisonWeekMs = useMemo(
    () => poisonedMsThisWeek(events, now),
    [events, now]
  );
  const cleanStreak = useMemo(
    () => poisonFreeStreak(events, now),
    [events, now]
  );
  const poisonBars = useMemo(
    () => lastNDaysPoisoned(events, now, 7),
    [events, now]
  );
  const maxPoisonMs = Math.max(...poisonBars.map((b) => b.poisonedMs), 1);
  const recap = useMemo(() => consumptionRecap(events, now, 30), [events, now]);
  const totals = useMemo(() => lifetimeTotals(events), [events]);

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
            unit="J"
            label="LA VAGUE 🌊"
            hintTitle={streakHint.title}
            hintBody={streakHint.body}
            color={streak > 0 ? C.segmentFull : C.textDim}
          />
        </View>

        <Text style={styles.section}>DEPUIS LE DÉBUT</Text>
        <View style={styles.cardRow}>
          <StatCard
            value={(totals.waterMl / 1000).toFixed(totals.waterMl >= 10_000 ? 0 : 1)}
            unit="L"
            label="EAU BUE EN TOUT"
            color={C.segmentFull}
          />
          <StatCard
            value={String(totals.alcoholUnits)}
            label="VERRES D'ALCOOL EN TOUT"
            color={totals.alcoholUnits > 0 ? C.poison : C.textDim}
          />
        </View>
        <Text style={styles.chartHint}>
          {totals.sinceMs
            ? `Ton compteur total depuis le ${formatSince(totals.sinceMs)} — il ne fait que monter.`
            : 'Ton compteur total démarrera dès ton premier verre.'}
        </Text>

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

        <Text style={[styles.section, styles.sectionPoison]}>EMPOISONNEMENT</Text>
        <View style={styles.cardRow}>
          <StatCard
            value={formatDuration(poisonWeekMs)}
            label="EN VIOLET (7 JOURS)"
            color={poisonWeekMs > 0 ? C.poison : C.segmentFull}
          />
          <StatCard
            value={String(cleanStreak)}
            label="JOURS SANS ALCOOL"
            color={cleanStreak > 0 ? C.segmentFull : C.textDim}
          />
        </View>
        <View style={[styles.chart, styles.chartPoison]}>
          {poisonBars.map((b, i) => {
            const h = Math.max(2, (b.poisonedMs / maxPoisonMs) * 90);
            const isToday = i === poisonBars.length - 1;
            return (
              <View key={b.dayStart} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: h,
                        backgroundColor:
                          b.poisonedMs > 0 ? C.poison : C.poisonEmpty,
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
          Objectif : le moins de temps en violet possible.
        </Text>

        <Text style={styles.section}>30 DERNIERS JOURS</Text>
        <View style={styles.cardRow}>
          <StatCard
            value={(recap.waterMl / 1000).toFixed(1)}
            unit="L"
            label="EAU BUE"
            color={C.segmentFull}
          />
          <StatCard
            value={String(recap.alcoholUnits)}
            label="VERRES D'ALCOOL"
            color={recap.alcoholUnits > 0 ? C.poison : C.textDim}
          />
        </View>
        <View style={styles.cardRow}>
          <StatCard
            value={formatDuration(recap.poisonedMs)}
            label="TEMPS EMPOISONNÉ"
            color={recap.poisonedMs > 0 ? C.poison : C.segmentFull}
          />
          <StatCard
            value={String(recap.cleanDays)}
            unit={`/ ${recap.cleanDays + recap.poisonedDays}`}
            label="JOURS PROPRES"
            color={C.segmentFull}
          />
        </View>

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
    flex: 1,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  sectionPoison: {
    color: C.poison,
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
  chartPoison: {
    borderWidth: 1,
    borderColor: 'rgba(180,76,255,0.22)',
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
