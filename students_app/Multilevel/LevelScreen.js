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
import { FontAwesome5 } from '@expo/vector-icons';

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

const sections = [
  {
    title: 'Listening',
    description: 'Improve your listening skills',
    icon: 'headphones',
  },
  {
    title: 'Reading',
    description: 'Practice reading comprehension',
    icon: 'book-reader',
  },
  {
    title: 'Speaking',
    description: 'Enhance your speaking fluency',
    icon: 'comments',
  },
  {
    title: 'Writing',
    description: 'Develop your writing skills',
    icon: 'pen',
  },
];

function IELTSScreen() {
  const navigation = useNavigation();
  const theme = useTheme();

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <ImageBackground
      source={require('../../assets/Cambridge_logo.png')}
      resizeMode="contain"
      style={styles.background}
      imageStyle={{ opacity: 0.15 }}
    >
      <View style={styles.appbarContainer}>
        <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
          <Appbar.BackAction onPress={handleGoBack} color={theme.colors.onPrimary} />
          <Appbar.Content
            title="MULTI LEVEL SECTIONS"
            titleStyle={{ color: theme.colors.onPrimary, fontWeight: 'bold' }}
          />
        </Appbar.Header>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {sections.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={[styles.sectionButton, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(item.title + 'Level',
              {
                level: item.level,
                category: 'multilevel',
              }
            )}
          >
            <FontAwesome5
              name={item.icon}
              size={24}
              color={theme.colors.onPrimary}
              style={styles.icon}
            />
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.onPrimary }]}>{item.title}</Text>
              <Text style={[styles.sectionDesc, { color: theme.colors.onPrimary + 'cc' }]}>{item.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ImageBackground>
  );
}

export default function LevelScreen() {
  return (
    <PaperProvider theme={customTheme}>
      <IELTSScreen />
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  appbarContainer: {
    // optional wrapper
  },
  container: {
    padding: 24,
    alignItems: 'center',
    gap: 20,
  },
  sectionButton: {
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 26,
    borderRadius: 14,
    marginBottom: 18,
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  icon: {
    marginRight: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sectionDesc: {
    fontSize: 15,
    marginTop: 6,
  },
});
