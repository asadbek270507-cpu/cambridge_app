import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_HEIGHT = width * 0.55; // ekranga mos proporsiya

const newsItems = [
  {
    title: 'We started to accept new students!',
    image: require('../assets/students.jpg'),
    subtitle: 'Join our new batch now!',
  },
  {
    title: 'New Multi-level Writing Book',
    image: require('../assets/writing_books.jpg'),
    subtitle: 'Improve your writing skills today.',
  },
  {
    title: 'Our school at night',
    image: require('../assets/cambridge_at_night.jpg'),
    subtitle: 'A beautiful view after dark.',
  },
];

const multiplier = 1000;
const infiniteData = Array.from(
  { length: newsItems.length * multiplier },
  (_, i) => newsItems[i % newsItems.length]
);

export default function NewsCarousel() {
  const flatListRef = useRef(null);
  const intervalRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);
  const startIndex =
    Math.floor(infiniteData.length / newsItems.length / 2) * newsItems.length;
  const scrollIndex = useRef(startIndex);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: scrollIndex.current * width,
        animated: false,
      });
    }, 100);

    startAutoScroll();
    return () => stopAutoScroll();
  }, []);

  const startAutoScroll = () => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (!isPaused && flatListRef.current) {
        scrollIndex.current += 1;
        flatListRef.current.scrollToOffset({
          offset: scrollIndex.current * width,
          animated: true,
        });
      }
    }, 3000);
  };

  const stopAutoScroll = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const handlePressIn = () => setIsPaused(true);
  const handlePressOut = () => setIsPaused(false);

  return (
    <View style={styles.carouselContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>News</Text>
      </View>
      <FlatList
        ref={flatListRef}
        data={infiniteData}
        keyExtractor={(_, i) => i.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => (
          <TouchableWithoutFeedback
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <View style={styles.card}>
              <Image
                source={item.image}
                style={styles.image}
                resizeMode="cover"
              />
              <View style={styles.overlay}>
                <Text style={styles.title}>{item.title}</Text>
                {item.subtitle && (
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  carouselContainer: {
    height: CARD_HEIGHT + 60,
    backgroundColor: '#fff',
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerText: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#1E1E1E',
  },
  card: {
    width: width * 0.9, // ekran bo‘ylab biroz joy qoldiradi
    height: CARD_HEIGHT,
    marginHorizontal: width * 0.05, // yonidan baland bo‘lib ketmasin
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5, // android soyasi
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#ddd',
    fontSize: 13,
    marginTop: 2,
  },
});
 