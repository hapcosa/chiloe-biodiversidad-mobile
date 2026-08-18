import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {AvistamientoDetailScreen} from '../screens/AvistamientoDetailScreen';
import {CameraScreen} from '../screens/CameraScreen';
import {EditarPerfilScreen} from '../screens/EditarPerfilScreen';
import {PerfilPublicoScreen} from '../screens/PerfilPublicoScreen';
import {PerfilScreen} from '../screens/PerfilScreen';

type PerfilStackParamList = {
  PerfilHome: undefined;
  Camara: undefined;
  EditarPerfil: undefined;
  PerfilPublico: {usuarioId: number};
  AvistamientoDetalle: {avistamientoId: number};
};

const Stack = createNativeStackNavigator<PerfilStackParamList>();

export const PerfilStackNavigator = (): React.JSX.Element => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="PerfilHome">
      {({navigation}) => (
        <PerfilScreen
          onEditProfile={() => navigation.navigate('EditarPerfil')}
          onOpenAvistamiento={avistamientoId =>
            navigation.navigate('AvistamientoDetalle', {avistamientoId})
          }
          onOpenCamera={() => navigation.navigate('Camara')}
        />
      )}
    </Stack.Screen>
    <Stack.Screen name="Camara">
      {({navigation}) => <CameraScreen onBack={() => navigation.goBack()} />}
    </Stack.Screen>
    <Stack.Screen name="EditarPerfil">
      {({navigation}) => (
        <EditarPerfilScreen
          onBack={() => navigation.goBack()}
          onSaved={() => navigation.goBack()}
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
