import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useIsFocused} from '@react-navigation/native';
import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {useAuth} from '../auth/AuthContext';
import {haVistoBienvenida, marcarBienvenidaVista} from '../db/bienvenida';
import {BienvenidaScreen} from '../screens/BienvenidaScreen';
import {BibliotecaScreen} from '../screens/BibliotecaScreen';
import {CameraScreen} from '../screens/CameraScreen';
import {GuardadosScreen} from '../screens/GuardadosScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {MapaScreen} from '../screens/MapaScreen';
import {colors} from '../styles/theme';
import {ensureInitialSpeciesSync} from '../sync/initialSync';
import {startMutationSyncWorker, syncPendingMutations} from '../sync/mutationSync';
import {ComunidadStackNavigator} from './ComunidadStackNavigator';
import {PerfilStackNavigator} from './PerfilStackNavigator';
import {SpeciesStackNavigator} from './SpeciesStackNavigator';

type RootTabParamList = {
  Home: undefined;
  Explorar: undefined;
  Capturar: undefined;
  Mapa: undefined;
  Comunidad: undefined;
  Guardados: undefined;
  Perfil: undefined;
};

const tabIcons: Record<keyof RootTabParamList, string> = {
  Home: '🏠',
  Explorar: '🔎',
  Capturar: '📷',
  Mapa: '🗺️',
  Comunidad: '👥',
  Guardados: '🔖',
  Perfil: '🙋',
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const HomeStack = (): React.JSX.Element => <SpeciesStackNavigator ListaScreen={HomeScreen} />;

const ExplorarStack = (): React.JSX.Element => (
  <SpeciesStackNavigator ListaScreen={BibliotecaScreen} />
);

const GuardadosStack = (): React.JSX.Element => (
  <SpeciesStackNavigator ListaScreen={GuardadosScreen} />
);

// Acceso rápido al visor desde cualquier parte de la app. La foto queda en la
// caché local; para asociarla a una especie se usa "Mi encuentro" en su ficha.
//
// Se desmonta al perder el foco: la pestaña no se descarga sola y dejaría la
// cámara tomada, con lo que ninguna otra pantalla podría abrirla.
const CapturarTab = (): React.JSX.Element => {
  const isFocused = useIsFocused();
  if (!isFocused) {
    return <View style={styles.centered} />;
  }
  return <CameraScreen />;
};

interface TabBarIconProps {
  routeName: keyof RootTabParamList;
  color: string;
  size: number;
}

const TabBarIcon = ({routeName, color, size}: TabBarIconProps): React.JSX.Element => (
  <Text style={{color, fontSize: size}}>{tabIcons[routeName]}</Text>
);

export const AppNavigator = (): React.JSX.Element => {
  const {isLoading, session} = useAuth();
  // `null` mientras se consulta: mostrar los tabs y tapar después con la
  // bienvenida daría un parpadeo justo en la pantalla que pide atención.
  const [bienvenidaVista, setBienvenidaVista] = useState<boolean | null>(null);

  useEffect(() => {
    void haVistoBienvenida().then(setBienvenidaVista);
  }, []);

  const cerrarBienvenida = useCallback(() => {
    setBienvenidaVista(true);
    void marcarBienvenidaVista();
  }, []);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    void ensureInitialSpeciesSync();
    void syncPendingMutations();
    return startMutationSyncWorker();
  }, [session]);

  if (isLoading || bienvenidaVista === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Cargando sesión...</Text>
      </View>
    );
  }

  // Antes del login: el criterio de uso vale igual para quien todavía no
  // tiene cuenta.
  if (!bienvenidaVista) {
    return <BienvenidaScreen onContinue={cerrarBienvenida} />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarIcon: ({color, size}) => (
          <TabBarIcon color={color} routeName={route.name} size={size} />
        ),
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.tabBar,
      })}>
      <Tab.Screen component={HomeStack} name="Home" />
      <Tab.Screen component={ExplorarStack} name="Explorar" />
      <Tab.Screen
        component={CapturarTab}
        name="Capturar"
        options={{tabBarLabel: 'Capturar'}}
      />
      <Tab.Screen component={MapaScreen} name="Mapa" />
      <Tab.Screen component={ComunidadStackNavigator} name="Comunidad" />
      <Tab.Screen component={GuardadosStack} name="Guardados" />
      <Tab.Screen component={PerfilStackNavigator} name="Perfil" />
    </Tab.Navigator>
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
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
});
