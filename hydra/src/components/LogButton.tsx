import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, FONTS, RADIUS } from '../theme/colors';

interface Props {
  label: string;
  sub?: string;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
}

export function LogButton({ label, sub, onPress, color = C.text, style }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        { borderColor: color, opacity: pressed ? 0.5 : 1 },
        style,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: 18,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0C10',
  },
  label: { fontFamily: FONTS.display, fontSize: 20, letterSpacing: 3 },
  sub: { fontFamily: FONTS.mono, fontSize: 12, color: C.textDim, marginTop: 4 },
});
