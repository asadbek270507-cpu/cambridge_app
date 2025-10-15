// src/screens/HomeScreen.js
import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomHeader from '../../components/CustomHeader';
import NewsCarousel from '../../components/NewsCarousel';
import CalendarView from '../../components/CalendarView';

// --- Responsive helpers (breakpoints in dp) ---
function useResponsiveLayout() {
  const { width: W } = useWindowDimensions();

  // Breakpoints (portrait uchun ma'qul qiymatlar)
  const isTablet   = W >= 768;
  const isPhablet  = W >= 600 && W < 768;   // katta telefonlar / kichik planshetlar
  const isLargePh  = W >= 430 && W < 600;   // iPhone Max / Pixel Pro kabi
  const isSmallPh  = W < 360;

  // Max content width (kenglik cheklovi)
  const contentMaxWidth = isTablet
    ? 720
    : isPhablet
    ? 520
    : isLargePh
    ? 420
    : isSmallPh
    ? 340
    : 380;

  // Yon paddings (ekran kattaligiga qarab)
  const sidePad = isTablet ? 24 : isPhablet ? 20 : isLargePh ? 18 : 16;
  const vertPad = isTablet ? 20 : isPhablet ? 18 : 16;

  // Bo‘limlar oralig‘i
  const sectionGap = isTablet ? 20 : isPhablet ? 18 : 16;

  return { contentMaxWidth, sidePad, vertPad, sectionGap };
}

export default function HomeScreen() {
  const { contentMaxWidth, sidePad, vertPad, sectionGap } = useResponsiveLayout();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <CustomHeader />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: sidePad, paddingVertical: vertPad },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={Platform.OS !== 'android'}
          overScrollMode={Platform.OS === 'android' ? 'never' : 'always'}
          contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : undefined}
        >
          {/* Centered wrapper with responsive max width */}
          <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
            {/* News */}
            <View style={styles.section}>
              <NewsCarousel />
            </View>

            {/* Calendar */}
            <View style={[styles.section, { marginTop: sectionGap }]}>
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
    alignItems: 'center', // center the content wrapper below
  },

  // Keeps inner content width stable & nice across devices
  content: {
    width: '100%',
  },

  // Each block/section takes full width of content wrapper
  section: {
    width: '100%',
  },
});
