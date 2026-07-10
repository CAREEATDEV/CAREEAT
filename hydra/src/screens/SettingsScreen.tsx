import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useHydration } from '../store/useHydration';
import { ensurePermissions } from '../notifications/scheduler';
import { C, FONTS, RADIUS } from '../theme/colors';

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export function SettingsScreen() {
  const { settings, updateSettings } = useHydration();
  const [notif, setNotif] = React.useState(true);

  const numberField = (
    key: keyof typeof settings,
    min = 0,
    max = 24
  ) => (
    <TextInput
      style={styles.input}
      keyboardType="numeric"
      defaultValue={String(settings[key])}
      onEndEditing={(e) => {
        const n = Math.max(min, Math.min(max, Number(e.nativeEvent.text) || 0));
        updateSettings({ [key]: n } as Partial<typeof settings>);
      }}
    />
  );

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={styles.title}>RÉGLAGES</Text>
        <Row label="OBJECTIF ML">{numberField('dailyGoalMl', 500, 6000)}</Row>
        <Row label="SOMMEIL DEBUT">{numberField('sleepStartHour', 0, 23)}</Row>
        <Row label="SOMMEIL FIN">{numberField('sleepEndHour', 0, 23)}</Row>
        <Row label="VERRE EAU ML">{numberField('waterMl', 100, 1000)}</Row>
        <Row label="BIÈRE ML">{numberField('beerMl', 100, 1000)}</Row>
        <Row label="VIN ML">{numberField('wineMl', 50, 500)}</Row>
        <Row label="SHOT ML">{numberField('shotMl', 20, 100)}</Row>
        <Row label="NOTIFS">
          <Switch
            value={notif}
            onValueChange={async (v) => {
              setNotif(v);
              if (v) await ensurePermissions();
            }}
          />
        </Row>
      </ScrollView>
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
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
  },
  label: { color: C.textDim, fontFamily: FONTS.label, letterSpacing: 2, minWidth: 140 },
  input: {
    color: C.text,
    fontFamily: FONTS.mono,
    textAlign: 'right',
    fontSize: 16,
  },
});
