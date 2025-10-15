// src/screens/TeacherDashboard.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

/* ----------- Responsive helpers (consistent across devices) ----------- */
const BASE_WIDTH = 360;
/** Clamp helper */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function useScale() {
  const { width, fontScale } = useWindowDimensions();
  // Keep sizes stable: do not upscale too much on large phones
  const raw = width / BASE_WIDTH;
  const scale = clamp(raw, 0.95, 1.05);
  const ms = (v) => Math.round(v * scale);
  // Keep fonts stable even if user has large OS font settings
  const mfs = (v) => Math.round((v * scale) / Math.min(fontScale || 1, 1.1));
  return { ms, mfs, width };
}

export default function TeacherDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const { ms, mfs, width } = useScale();

  // Phones -> 2 columns. Only *bigger* tablets -> 3 columns.
  const isTablet = width >= 900;
  const cardWidth = isTablet ? '31.5%' : '48%';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: ms(16) + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.header, { fontSize: mfs(20) }]} allowFontScaling={false}>
          Teacher Dashboard
        </Text>

        <View style={styles.cardContainer}>
          <DashCard
            width={cardWidth}
            icon="book-open-page-variant"
            label="Manage Lessons"
            colors={['#7F00FF', '#E100FF']}
            ms={ms}
            mfs={mfs}
            onPress={() => navigation.navigate('ManageScreen')}
          />

          <DashCard
            width={cardWidth}
            icon="account-plus"
            label="Register students"
            colors={['#11998e', '#38ef7d']}
            ms={ms}
            mfs={mfs}
            onPress={() => navigation.navigate('RegisterScreen')}
          />

          <DashCard
            width={cardWidth}
            icon="chat"
            label="Student Chats"
            colors={['#00C6FF', '#0072FF']}
            ms={ms}
            mfs={mfs}
            onPress={() => navigation.navigate('ChatScreen')}
          />

          <DashCard
            width={cardWidth}
            icon="calendar"
            label="Calendar"
            colors={['#f7971e', '#ffd200']}
            ms={ms}
            mfs={mfs}
            onPress={() => navigation.navigate('TeacherAvailabilityScreen')}
          />

          <DashCard
            width={cardWidth}
            icon="account-check"
            label="Attendance"
            colors={['#ff512f', '#dd2476']}
            ms={ms}
            mfs={mfs}
            onPress={() => navigation.navigate('AttendanceScreen')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DashCard({ icon, label, colors, onPress, width, ms, mfs }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
      style={({ pressed }) => [
        styles.cardWrap,
        { width, borderRadius: ms(16), marginBottom: ms(16) },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.card,
          {
            borderRadius: ms(16),
            paddingVertical: ms(18),
            paddingHorizontal: ms(14),
            minHeight: ms(110),
          },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            {
              width: ms(50),
              height: ms(50),
              borderRadius: ms(25),
              marginBottom: ms(10),
            },
          ]}
        >
          <Icon name={icon} size={ms(24)} color="#ffffff" />
        </View>
        <Text
          style={[styles.cardText, { fontSize: mfs(14), lineHeight: mfs(18) }]}
          numberOfLines={2}
          allowFontScaling={false}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    fontWeight: '900',
    color: '#111827',
    marginBottom: 18,
    textAlign: 'center',
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // Shadowed wrapper to keep nice elevation on both platforms
  cardWrap: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
  },
});
