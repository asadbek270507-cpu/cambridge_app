import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function TeacherDashboard({ navigation }) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Teacher Dashboard</Text>

      <View style={styles.cardContainer}>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ManageScreen')}> 
          <Icon name="book-open-page-variant" size={40} color="#8B0000" />
          <Text style={styles.cardText}>Manage Lessons</Text>
        </TouchableOpacity>

 <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('RegisterScreen')}>
          <Icon name="login" size={40} color="#8B0000" />
          <Text style={styles.cardText}>Register login</Text>
        </TouchableOpacity>

         <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Notification')}> 
          <Icon name="bell" size={40} color="#8B0000" />
          <Text style={styles.cardText}>Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('News')}> 
          <Icon name="book" size={40} color="#8B0000" />
          <Text style={styles.cardText}>News</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ChatScreen')}> 
          <Icon name="chat" size={40} color="#8B0000" />
          <Text style={styles.cardText}>Student Chats</Text>
        </TouchableOpacity>
       <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TeacherAvailabilityScreen ')}>
          <Icon name="calendar" size={40} color="#8B0000" />
          <Text style={styles.cardText}>Calendar</Text>
        </TouchableOpacity>

       

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B0000',
    marginBottom: 20,
    textAlign: 'center',
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardText: {
    marginTop: 10,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});
