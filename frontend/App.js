import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { RouterProvider, useNav } from './src/nav/RouterContext';
import Layout from './src/components/Layout';
import LoginScreen from './src/screens/LoginScreen';
import LandingScreen from './src/screens/public/LandingScreen';
import { SCREENS } from './src/screens';
import { COLORS } from './src/design-system/tokens';

/**
 * Shell Tec[ode ERP: cabecera + menú lateral responsive + 22 pantallas.
 */
function Shell() {
  const { route } = useNav();
  const Screen = SCREENS[route.name] || SCREENS.home;
  return (
    <Layout>
      <Screen />
    </Layout>
  );
}

function Root() {
  const { session, initializing } = useAuth();
  const [viewState, setViewState] = useState('landing'); // 'landing' | 'login'

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!session) {
    if (viewState === 'landing') {
      return <LandingScreen onGoLogin={() => setViewState('login')} />;
    }
    return <LoginScreen />;
  }

  return (
    <RouterProvider>
      <Shell />
    </RouterProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});
