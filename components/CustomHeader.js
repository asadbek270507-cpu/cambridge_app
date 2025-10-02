import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Text as RNText } from 'react-native';
import { IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, firestore } from '../firebase'; // keep this path consistent with your project

const { width } = Dimensions.get('window');

export default function CustomHeader() {
  const navigation = useNavigation();

  const [userId, setUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Track current user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUserId(u?.uid ?? null));
    return unsub;
  }, []);

  // Live unread counter
  useEffect(() => {
    let unsub = null;
    if (userId) {
      const q = query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(
        q,
        snap => {
          let count = 0;
          snap.forEach(d => {
            const n = d.data() || {};
            const readByMe = !!(n?.readBy && n.readBy[userId]);
            const isRead = !!n?.read || readByMe;
            if (!isRead) count += 1;
          });
          setUnreadCount(count);
        },
        err => {
          console.warn('notifications badge stream error:', err?.message || String(err));
          setUnreadCount(0);
        }
      );
    } else {
      setUnreadCount(0);
    }
    return () => { if (unsub) unsub(); };
  }, [userId]);

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

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

        <View style={styles.iconWrap}>
          <IconButton
            icon="bell-outline"
            size={24}
            onPress={() => navigation.navigate('NotificationsListScreen')}
            iconColor="#8B0000"
          />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <RNText style={styles.badgeText}>{displayCount}</RNText>
            </View>
          )}
        </View>
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
  iconWrap: {
    position: 'relative',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
