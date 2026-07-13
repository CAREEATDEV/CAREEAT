import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { View, Text } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { DataScreen } from './src/screens/DataScreen';
import { WidgetsScreen } from './src/screens/WidgetsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { C, FONTS } from './src/theme/colors';
import { ensurePermissions } from './src/notifications/scheduler';
import { useHydration } from './src/store/useHydration';

const Tab = createBottomTabNavigator();

function Splash() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: C.segmentFull,
          fontFamily: FONTS.display,
          fontSize: 40,
          letterSpacing: 10,
        }}
      >
        HYDRA
      </Text>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'ChakraPetch-Bold': require('./assets/fonts/ChakraPetch-Bold.ttf'),
    'ChakraPetch-SemiBold': require('./assets/fonts/ChakraPetch-SemiBold.ttf'),
    'IBMPlexMono-Regular': require('./assets/fonts/IBMPlexMono-Regular.ttf'),
    'IBMPlexMono-Bold': require('./assets/fonts/IBMPlexMono-Bold.ttf'),
  });

  const onboarded = useHydration((s) => s.onboarded);
  const [storeHydrated, setStoreHydrated] = useState(
    useHydration.persist.hasHydrated()
  );

  useEffect(() => {
    ensurePermissions().catch(() => {});
    const unsub = useHydration.persist.onFinishHydration(() =>
      setStoreHydrated(true)
    );
    setStoreHydrated(useHydration.persist.hasHydrated());
    return unsub;
  }, []);

  // Wait for fonts AND persisted state before deciding what to show, so we never
  // flash the onboarding for a returning user.
  if (!fontsLoaded || !storeHydrated) {
    return <Splash />;
  }

  if (!onboarded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <OnboardingScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
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
            <Tab.Screen name="BARRE" component={HomeScreen} />
            <Tab.Screen name="DONNÉES" component={DataScreen} />
            <Tab.Screen
              name="WIDGETS"
              component={WidgetsScreen}
              options={{
                tabBarLabel: ({ focused }) => (
                  <Text
                    style={{
                      fontFamily: FONTS.display,
                      letterSpacing: 2,
                      fontSize: 12,
                      color: C.segmentFull,
                      opacity: focused ? 1 : 0.75,
                    }}
                  >
                    ★ WIDGETS
                  </Text>
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
