import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {useAuth} from '../auth/AuthContext';
import {BibliotecaScreen} from '../screens/BibliotecaScreen';
import {CameraScreen} from '../screens/CameraScreen';
import {EspecieDetailScreen} from '../screens/EspecieDetailScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {PerfilScreen} from '../screens/PerfilScreen';
import {colors} from '../styles/theme';
import {startMutationSyncWorker, syncPendingMutations} from '../sync/mutationSync';
import type {Species} from '../types/domain';

type Route =
  | {name: 'biblioteca'}
  | {name: 'camera'}
  | {name: 'detalle'; species: Species}
  | {name: 'perfil'};

export const AppNavigator = (): React.JSX.Element => {
  const {isLoading, session} = useAuth();
  const [route, setRoute] = useState<Route>({name: 'biblioteca'});

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    void syncPendingMutations();
    return startMutationSyncWorker();
  }, [session]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Cargando sesión...</Text>
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (route.name === 'detalle') {
    return (
      <EspecieDetailScreen
        onBack={() => setRoute({name: 'biblioteca'})}
        species={route.species}
      />
    );
  }

  if (route.name === 'perfil') {
    return (
      <PerfilScreen
        onBack={() => setRoute({name: 'biblioteca'})}
        onOpenCamera={() => setRoute({name: 'camera'})}
      />
    );
  }

  if (route.name === 'camera') {
    return <CameraScreen onBack={() => setRoute({name: 'perfil'})} />;
  }

  return (
    <BibliotecaScreen
      onOpenProfile={() => setRoute({name: 'perfil'})}
      onSelectSpecies={species => setRoute({name: 'detalle', species})}
    />
  );
};

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.muted,
    marginTop: 12,
  },
});
