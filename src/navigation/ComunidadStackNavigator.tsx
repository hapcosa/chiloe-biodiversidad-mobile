import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {AvistamientoDetailScreen} from '../screens/AvistamientoDetailScreen';
import {FeedScreen} from '../screens/FeedScreen';
import {PerfilPublicoScreen} from '../screens/PerfilPublicoScreen';

type ComunidadStackParamList = {
  ComunidadHome: undefined;
  PerfilPublico: {usuarioId: number};
  AvistamientoDetalle: {avistamientoId: number};
};

const Stack = createNativeStackNavigator<ComunidadStackParamList>();

export const ComunidadStackNavigator = (): React.JSX.Element => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="ComunidadHome">
      {({navigation}) => (
        <FeedScreen
          onOpenAvistamiento={avistamientoId =>
            navigation.navigate('AvistamientoDetalle', {avistamientoId})
          }
        />
      )}
    </Stack.Screen>
    <Stack.Screen name="PerfilPublico">
      {({navigation, route}) => (
        <PerfilPublicoScreen
          onBack={() => navigation.goBack()}
          usuarioId={route.params.usuarioId}
        />
      )}
    </Stack.Screen>
    <Stack.Screen name="AvistamientoDetalle">
      {({navigation, route}) => (
        <AvistamientoDetailScreen
          avistamientoId={route.params.avistamientoId}
          onBack={() => navigation.goBack()}
          onOpenPerfil={usuarioId => navigation.navigate('PerfilPublico', {usuarioId})}
        />
      )}
    </Stack.Screen>
  </Stack.Navigator>
);
