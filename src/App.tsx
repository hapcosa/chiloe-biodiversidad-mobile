import {NavigationContainer} from '@react-navigation/native';
import React from 'react';
import {StatusBar, StyleSheet} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {AuthProvider} from './auth/AuthContext';
import {AppNavigator} from './navigation/AppNavigator';
import {colors} from './styles/theme';

const App = (): React.JSX.Element => (
  <SafeAreaProvider>
    <AuthProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaView>
    </AuthProvider>
  </SafeAreaProvider>
);

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
});

export default App;
