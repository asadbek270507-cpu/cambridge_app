import React from 'react';
import { View, StyleSheet, Dimensions, Text as RNText } from 'react-native';
import { IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native'; // ✅ qo'shildi

const { width } = Dimensions.get('window');

export default function CustomHeader() {
  const navigation = useNavigation(); // ✅ navigation olish

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <RNText
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Cambridge Innovation School
        </RNText>
        <IconButton
          icon="bell-outline"
          size={24}
          onPress={() => navigation.navigate("NotificationsListScreen")} // ✅ sahifaga o'tadi
          iconColor="#8B0000"
        />
      </View>
    </SafeAreaView>
  );
}

const scaleFont = (size) => Math.round(size * (width / 375));

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#F3F4F6',
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#8B0000',
  },
  title: {
    flex: 1,
    fontSize: scaleFont(16),
    fontWeight: 'bold',
    color: '#000',
  },
});
