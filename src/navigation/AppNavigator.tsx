import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import React, {useEffect} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {useAuth} from '../auth/AuthContext';
import {BibliotecaScreen} from '../screens/BibliotecaScreen';
import {GuardadosScreen} from '../screens/GuardadosScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {colors} from '../styles/theme';
import {startMutationSyncWorker, syncPendingMutations} from '../sync/mutationSync';
import {ComunidadStackNavigator} from './ComunidadStackNavigator';
import {PerfilStackNavigator} from './PerfilStackNavigator';
import {SpeciesStackNavigator} from './SpeciesStackNavigator';

type RootTabParamList = {
  Home: undefined;
  Explorar: undefined;
  Comunidad: undefined;
  Guardados: undefined;
  Perfil: undefined;
};

const tabIcons: Record<keyof RootTabParamList, string> = {
  Home: '🏠',
  Explorar: '🔎',
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
