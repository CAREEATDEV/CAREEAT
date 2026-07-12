import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useHydration } from '../store/useHydration';
import { ensurePermissions } from '../notifications/scheduler';
import { C, FONTS, RADIUS } from '../theme/colors';
import { dailyNeedMl } from '../engine/hydrationEngine';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export function SettingsScreen() {
  const { profile, updateProfile } = useHydration();
  const [notif, setNotif] = React.useState(true);

  const num = (
    key: keyof typeof profile,
    min: number,
    max: number,
    step = 1
  ) => (
    <TextInput
      style={styles.input}
      keyboardType="numeric"
      defaultValue={String((profile[key] as number | null) ?? '')}
      onEndEditing={(e) => {
        const parsed = Number(e.nativeEvent.text.replace(',', '.'));
        if (isNaN(parsed)) return;
        const clamped = Math.max(min, Math.min(max, parsed));
        updateProfile({ [key]: Math.round(clamped / step) * step } as any);
      }}
    />
  );

  const need = dailyNeedMl(profile);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 60 }}>
        <Text style={styles.title}>RÉGLAGES</Text>

        <Text style={styles.section}>PROFIL</Text>
        <Row label="POIDS (kg)">{num('weightKg', 30, 200)}</Row>
        <Row label="SEXE">
          <View style={styles.pill}>
            {(['male', 'female'] as const).map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.pillOpt,
                  profile.sex === s && styles.pillOptActive,
                ]}
                onPress={() => updateProfile({ sex: s })}
              >
                <Text
                  style={[
                    styles.pillTxt,
                    profile.sex === s && { color: C.bg },
                  ]}
                >
                  {s === 'male' ? 'H' : 'F'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Row>
        <Row label="HEURES ÉVEIL">{num('awakeHours', 8, 20)}</Row>
        <Row label="SOMMEIL DÉBUT">{num('sleepStartHour', 0, 23)}</Row>
        <Row label="SOMMEIL FIN">{num('sleepEndHour', 0, 23)}</Row>
        <Row label="TEMP AMBIANTE °C">{num('ambientTempC', -20, 50)}</Row>
        <Row label="ALTITUDE (m)">{num('altitudeM', 0, 8000, 100)}</Row>

        <Text style={styles.section}>OBJECTIF</Text>
        <Row label="AUTO">
          <Text style={styles.readonly}>
            {Math.round(need)} mL / jour ({profile.weightKg} × 32)
          </Text>
        </Row>

        <Text style={styles.section}>NOTIFICATIONS</Text>
        <Row label="ACTIVER">
          <Switch
            value={notif}
            onValueChange={async (v) => {
              setNotif(v);
              if (v) await ensurePermissions();
            }}
          />
        </Row>

        <Text style={styles.disclaimer}>
          Ceci est une app grand public à but ludique et informatif. Ce n'est
          pas un dispositif médical. Les coefficients sont des moyennes de
          population. Consulte un professionnel de santé pour tout besoin
          d'hydratation spécifique.
        </Text>
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
    marginBottom: 6,
  },
  section: {
    color: C.textDim,
    fontFamily: FONTS.label,
    letterSpacing: 3,
    marginTop: 18,
    marginBottom: 4,
    fontSize: 11,
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
  label: {
    color: C.textDim,
    fontFamily: FONTS.label,
    letterSpacing: 2,
    minWidth: 130,
    fontSize: 11,
  },
  input: {
    color: C.text,
    fontFamily: FONTS.mono,
    textAlign: 'right',
    fontSize: 16,
  },
  readonly: {
    color: C.text,
    fontFamily: FONTS.mono,
    textAlign: 'right',
    fontSize: 14,
  },
  pill: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: 6,
  },
  pillOpt: {
    borderWidth: 1.5,
    borderColor: C.segmentEmpty,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pillOptActive: {
    backgroundColor: C.segmentFull,
    borderColor: C.segmentFull,
  },
  pillTxt: {
    color: C.text,
    fontFamily: FONTS.display,
    letterSpacing: 2,
    fontSize: 12,
  },
  disclaimer: {
    marginTop: 30,
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    lineHeight: 16,
  },
});
