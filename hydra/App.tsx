import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { View, Text } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { C, FONTS } from './src/theme/colors';
import { ensurePermissions } from './src/notifications/scheduler';

const Tab = createBottomTabNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    'ChakraPetch-Bold': require('./assets/fonts/ChakraPetch-Bold.ttf'),
    'ChakraPetch-SemiBold': require('./assets/fonts/ChakraPetch-SemiBold.ttf'),
    'IBMPlexMono-Regular': require('./assets/fonts/IBMPlexMono-Regular.ttf'),
    'IBMPlexMono-Bold': require('./assets/fonts/IBMPlexMono-Bold.ttf'),
  });

  useEffect(() => {
    ensurePermissions().catch(() => {});
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.text, fontSize: 22, letterSpacing: 6 }}>HYDRA</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary: C.segmentFull,
              background: C.bg,
              card: C.bg,
              text: C.text,
              border: C.bgSoft,
              notification: C.red,
            },
          }}
        >
          <StatusBar style="light" />
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.bgSoft },
              tabBarActiveTintColor: C.segmentFull,
              tabBarInactiveTintColor: C.textDim,
              tabBarLabelStyle: { fontFamily: FONTS.label, letterSpacing: 2 },
            }}
          >
            <Tab.Screen name="BAR" component={HomeScreen} />
            <Tab.Screen name="LOG" component={HistoryScreen} />
            <Tab.Screen name="RÉGLAGES" component={SettingsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
