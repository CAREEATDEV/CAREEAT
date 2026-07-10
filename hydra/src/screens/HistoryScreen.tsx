import React from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useHydration } from '../store/useHydration';
import { C, FONTS, RADIUS } from '../theme/colors';

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
  const items = events.filter((e) => e.type === 'drink' && isSameDay(e.at)).reverse();

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>JOURNÉE</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.at)}
        contentContainerStyle={{ padding: 20, gap: 8 }}
        renderItem={({ item }) => {
          if (item.type !== 'drink') return null;
          const t = new Date(item.at);
          const hh = t.getHours().toString().padStart(2, '0');
          const mm = t.getMinutes().toString().padStart(2, '0');
          return (
            <View style={styles.row}>
              <Text style={styles.time}>{hh}:{mm}</Text>
              <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
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
  },
  time: { color: C.textDim, fontFamily: FONTS.mono },
  kind: { color: C.text, fontFamily: FONTS.label, letterSpacing: 3 },
  del: { color: C.red, fontSize: 22, paddingHorizontal: 8 },
  empty: { color: C.textDim, fontFamily: FONTS.mono, textAlign: 'center', marginTop: 40 },
});
