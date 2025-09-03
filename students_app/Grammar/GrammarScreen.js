import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Appbar, useTheme, MD3LightTheme, Provider as PaperProvider } from 'react-native-paper';

const customTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#B71C1C',
    accent: '#ffebd6ff',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    onPrimary: '#FFFFFF',
    onSurface: '#212121',
  },
};

const grammarLevels = [
  { level: 'Beginner and Elementary', description: 'Simple structures for fresh learners' },
  { level: 'Pre-Intermediate', description: 'Starting to connect ideas' },
  { level: 'Intermediate', description: 'More complex grammar and usage' },
  { level: 'Advanced', description: 'Master-level grammar and nuances' },
];

function GrammarScreen() {
  const navigation = useNavigation();
  const theme = useTheme();

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <ImageBackground
      source={require('../../assets/Cambridge_logo.png')}
      resizeMode="cover"
      style={styles.background}
      imageStyle={{ opacity: 0.15 }}
    >
      <View style={styles.appbarContainer}>
        <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
          <Appbar.BackAction onPress={handleGoBack} color={theme.colors.onPrimary} />
          <Appbar.Content
            title="GRAMMAR LEVELS"
            titleStyle={{ color: theme.colors.onPrimary, fontWeight: 'bold' }}
          />
        </Appbar.Header>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
    

        {grammarLevels.map((item) => (
          <TouchableOpacity
            key={item.level}
            style={[styles.levelButton, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('GrammarMaterials', 
                {
                level: item.level,
                category: 'grammar',
                })
            }
          >
            <Text style={[styles.levelText, { color: theme.colors.onPrimary }]}>{item.level}</Text>
            <Text style={[styles.levelDesc, { color: theme.colors.onPrimary + 'cc' }]}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ImageBackground>
  );
}

export default function GrammarScreenWrapper() {
  return (
    <PaperProvider theme={customTheme}>
      <GrammarScreen />
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  appbarContainer: {
    // Optional wrapper
  },
  container: {
    padding: 24,
    alignItems: 'center',
    gap: 20,
  },
  subtitle: {
    fontSize: 17,
    marginBottom: 25,
    textAlign: 'center',
    color: '#475569',
  },
  levelButton: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 22,
    paddingHorizontal: 26,
    borderRadius: 14,
    marginBottom: 18,
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  levelText: {
    fontSize: 22,
    fontWeight: '700',
  },
  levelDesc: {
    fontSize: 15,
    marginTop: 6,
  },
});
