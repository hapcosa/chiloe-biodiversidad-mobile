import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {EspecieDetailScreen} from '../screens/EspecieDetailScreen';
import {MiEncuentroFormScreen} from '../screens/MiEncuentroFormScreen';
import type {Species} from '../types/domain';

export type SpeciesStackParamList = {
  Lista: undefined;
  Detalle: {species: Species};
  Encuentro: {species: Species};
};

const Stack = createNativeStackNavigator<SpeciesStackParamList>();

interface SpeciesStackNavigatorProps {
  ListaScreen: React.ComponentType<{onSelectSpecies: (species: Species) => void}>;
}

// Stack compartido por las tabs que navegan a una especie (Home, Explorar,
// Guardados): cada una tiene su propia pantalla raíz pero comparten
// Detalle/Encuentro, así no se duplica esa lógica por tab.
export const SpeciesStackNavigator = ({
  ListaScreen,
}: SpeciesStackNavigatorProps): React.JSX.Element => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="Lista">
      {({navigation}) => (
        <ListaScreen onSelectSpecies={species => navigation.navigate('Detalle', {species})} />
      )}
    </Stack.Screen>
    <Stack.Screen name="Detalle">
      {({navigation, route}) => (
        <EspecieDetailScreen
          onAddEncuentro={() => navigation.navigate('Encuentro', {species: route.params.species})}
          onBack={() => navigation.goBack()}
          species={route.params.species}
        />
      )}
    </Stack.Screen>
    <Stack.Screen name="Encuentro">
      {({navigation, route}) => (
        <MiEncuentroFormScreen
          onBack={() => navigation.goBack()}
          onSaved={() => navigation.popToTop()}
          species={route.params.species}
        />
      )}
    </Stack.Screen>
  </Stack.Navigator>
);
