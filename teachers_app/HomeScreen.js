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

export default function TeacherDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // 2 columns on phones, 3 on wider/tablet screens
  const isWide = width >= 720;
  const cardWidth = isWide ? '31.5%' : '48%';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 16 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Teacher Dashboard</Text>

        <View style={styles.cardContainer}>
          <DashCard
            width={cardWidth}
            icon="book-open-page-variant"
            label="Manage Lessons"
            colors={['#7F00FF', '#E100FF']}
            onPress={() => navigation.navigate('ManageScreen')}
          />

          <DashCard
            width={cardWidth}
            icon="account-plus"
            label="Register students"
            colors={['#11998e', '#38ef7d']}
            onPress={() => navigation.navigate('RegisterScreen')}
          />

          <DashCard
            width={cardWidth}
            icon="chat"
            label="Student Chats"
            colors={['#00C6FF', '#0072FF']}
            onPress={() => navigation.navigate('ChatScreen')}
          />

          <DashCard
            width={cardWidth}
            icon="calendar"
            label="Calendar"
            colors={['#f7971e', '#ffd200']}
            onPress={() => navigation.navigate('TeacherAvailabilityScreen')}
          />

          <DashCard
            width={cardWidth}
            icon="account-check"
            label="Attendance"
            colors={['#ff512f', '#dd2476']}
            onPress={() => navigation.navigate('AttendanceScreen')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DashCard({ icon, label, colors, onPress, width }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      style={({ pressed }) => [
        styles.cardWrap,
        { width },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon name={icon} size={28} color="#ffffff" />
        </View>
        <Text style={styles.cardText} numberOfLines={2}>
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
    fontSize: 24,
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
    marginBottom: 16,
    borderRadius: 16,
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
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 112,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
});
