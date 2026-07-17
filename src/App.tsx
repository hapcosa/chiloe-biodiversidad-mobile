import React from 'react';
import {SafeAreaView, StatusBar, StyleSheet} from 'react-native';
import {AuthProvider} from './auth/AuthContext';
import {AppNavigator} from './navigation/AppNavigator';
import {colors} from './styles/theme';

const App = (): React.JSX.Element => (
  <AuthProvider>
    <SafeAreaView style={styles.root}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <AppNavigator />
    </SafeAreaView>
  </AuthProvider>
);

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
});

export default App;

