import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { RouterProvider, useNav } from './src/nav/RouterContext';
import Layout from './src/components/Layout';
import LoginScreen from './src/screens/LoginScreen';
import { SCREENS } from './src/screens';

/**
 * FASE 7: shell completo.
 *  - AuthProvider  → sesión (login/logout/permisos).
 *  - RouterProvider → pila de rutas en memoria.
 *  - Layout        → cabecera + menú por permisos + contenido.
 *  - SCREENS       → registro de las 22 pantallas.
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

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <RouterProvider>
      <Shell />
    </RouterProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
});
