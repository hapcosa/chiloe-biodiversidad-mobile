import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {CameraScreen} from '../screens/CameraScreen';
import {PerfilScreen} from '../screens/PerfilScreen';

type PerfilStackParamList = {
  PerfilHome: undefined;
  Camara: undefined;
};

const Stack = createNativeStackNavigator<PerfilStackParamList>();

export const PerfilStackNavigator = (): React.JSX.Element => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="PerfilHome">
      {({navigation}) => <PerfilScreen onOpenCamera={() => navigation.navigate('Camara')} />}
    </Stack.Screen>
    <Stack.Screen name="Camara">
      {({navigation}) => <CameraScreen onBack={() => navigation.goBack()} />}
    </Stack.Screen>
  </Stack.Navigator>
);
