import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {AvistamientoDetailScreen} from '../screens/AvistamientoDetailScreen';
import {FeedScreen} from '../screens/FeedScreen';

type ComunidadStackParamList = {
  ComunidadHome: undefined;
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
    <Stack.Screen name="AvistamientoDetalle">
      {({navigation, route}) => (
        <AvistamientoDetailScreen
          avistamientoId={route.params.avistamientoId}
          onBack={() => navigation.goBack()}
        />
      )}
    </Stack.Screen>
  </Stack.Navigator>
);
