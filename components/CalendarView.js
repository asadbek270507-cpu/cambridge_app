import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';

export default function CalendarView() {
  return (
    <View style={styles.container}>
      <Calendar
        // dars bor kunlar
        markedDates={{
          '2025-07-21': { marked: true, dotColor: '#f94141ff' },
          '2025-07-23': { marked: true, dotColor: '#8B0000' },
          '2025-07-25': { marked: true, dotColor: '#8B0000' },
        }}
        theme={{
          selectedDayBackgroundColor: '#8B0000',
          todayTextColor: '#8B0000',
          arrowColor: '#8B0000',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '90%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    padding: 10,
    elevation: 3,
  },
});
