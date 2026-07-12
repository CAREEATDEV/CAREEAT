import React from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useHydration } from '../store/useHydration';
import { C, FONTS, RADIUS } from '../theme/colors';
import { HydrationEvent } from '../engine/hydrationEngine';

function labelFor(e: HydrationEvent): { text: string; color: string } {
  switch (e.type) {
    case 'water':
      return { text: `EAU  ${e.volumeMl}ml`, color: C.segmentFull };
    case 'electrolytes':
      return { text: `ÉLECTROLYTES  ${e.volumeMl}ml`, color: C.segmentFull };
    case 'alcohol':
      return {
        text: `ALCOOL  ${e.volumeMl}ml / ${e.abv}%`,
        color: C.poison,
      };
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

export function HistoryScreen() {
  const { events, deleteEvent } = useHydration();
  const today = new Date();
  const isSameDay = (t: number) => {
    const d = new Date(t);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };
  const items = events.filter((e) => isSameDay(e.at)).reverse();

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>JOURNÉE</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.at) + item.type}
        contentContainerStyle={{ padding: 20, gap: 8 }}
        renderItem={({ item }) => {
          const t = new Date(item.at);
          const hh = t.getHours().toString().padStart(2, '0');
          const mm = t.getMinutes().toString().padStart(2, '0');
          const { text, color } = labelFor(item);
          return (
            <View style={styles.row}>
              <Text style={styles.time}>
                {hh}:{mm}
              </Text>
              <Text style={[styles.kind, { color }]}>{text}</Text>
              <Pressable onPress={() => deleteEvent(item.at)}>
                <Text style={styles.del}>×</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun événement aujourd'hui.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 22,
    letterSpacing: 4,
    padding: 20,
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
  kind: {
    flex: 1,
    fontFamily: FONTS.label,
    letterSpacing: 2,
    fontSize: 12,
  },
  del: { color: C.red, fontSize: 22, paddingHorizontal: 8 },
  empty: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    textAlign: 'center',
    marginTop: 40,
  },
});
