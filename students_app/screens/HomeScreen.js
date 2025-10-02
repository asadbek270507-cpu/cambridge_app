// src/screens/HomeScreen.js
import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import CustomHeader from '../../components/CustomHeader';
import NewsCarousel from '../../components/NewsCarousel';
import CalendarView from '../../components/CalendarView'; // path to'g'ri

// ---- Layout constants (dp) ----
const H_PADDING = 16;         // horizontal screen padding
const V_PADDING = 16;         // vertical screen padding
const CONTENT_MAX_WIDTH = 560; // tablet/katta ekranda ham barqaror ko'rinish
const SECTION_GAP = 16;

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header — CustomHeader ichida safe-area bo'lsa ham, bu yerda ham xavfsiz */}
        <CustomHeader />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode={Platform.OS === 'android' ? 'never' : 'always'}
        >
          {/* Centered, fixed max-width content wrapper */}
          <View style={styles.content}>
            {/* News */}
            <View style={styles.section}>
              <NewsCarousel />
            </View>

            {/* Calendar */}
            <View style={[styles.section, styles.sectionSpacing]}>
              <CalendarView />
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // ScrollView content is centered with side paddings
  scrollContent: {
    paddingHorizontal: H_PADDING,
    paddingVertical: V_PADDING,
    alignItems: 'center', // center the content wrapper below
  },

  // Wrapper that keeps inner content width stable across devices
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
  },

  // Each block/section takes full width of content wrapper
  section: {
    width: '100%',
  },
  sectionSpacing: {
    marginTop: SECTION_GAP,
  },
});
