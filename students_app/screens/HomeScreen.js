import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import CustomHeader from '../../components/CustomHeader';
import NewsCarousel from '../../components/NewsCarousel';
import CalendarView from '../../components/CalendarView'; // manzil to'g'rilangan bo'lishi kerak

export default function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <CustomHeader />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <NewsCarousel />
        
        <View style={styles.section}>
          <CalendarView />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 20,
  },
  section: {
    alignItems: 'center',
    marginVertical: 16,
  },
});