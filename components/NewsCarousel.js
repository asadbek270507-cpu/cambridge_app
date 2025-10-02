// screens/StudentNewsCarousel.js
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  Dimensions, Pressable, ActivityIndicator, Modal,
  SafeAreaView, ScrollView, StatusBar
} from 'react-native';
import { firestore } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

const { width: W, height: H } = Dimensions.get('window');

/* --- Layout o‘lchamlari (rasm + caption) --- */
const IMAGE_H = Math.round(W * 0.52); // rasm balandligi
const CAPTION_MIN_H = 64;             // kamida caption balandligi
const CARD_V_SPACING = 10;            // kartalar atrofida vert. bo‘shliq
const CARD_H = IMAGE_H + CAPTION_MIN_H; // umumiy karta balandligi (taxmin)

const MULTIPLIER = 1000;

export default function NewsCarousel() {
  const flatListRef = useRef(null);
  const intervalRef = useRef(null);
  const scrollIndex = useRef(0);

  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [aspect, setAspect] = useState(null); // w/h

  /* === Firestore'dan yangiliklar === */
  useEffect(() => {
    const q = query(collection(firestore, 'news'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        setNews(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const baseData = useMemo(
    () => news.map(n => ({
      id: n.id,
      title: n.text ? String(n.text).trim() : '',
      imageUrl: n.imageUrl || null,
      createdAt: n.createdAt || null,
    })),
    [news]
  );

  const infiniteData = useMemo(() => {
    if (!baseData.length) return [];
    return Array.from({ length: baseData.length * MULTIPLIER }, (_, i) => baseData[i % baseData.length]);
  }, [baseData]);

  const startIndex = useMemo(() => {
    if (!baseData.length) return 0;
    return Math.floor(infiniteData.length / baseData.length / 2) * baseData.length;
  }, [baseData.length, infiniteData.length]);

  useEffect(() => {
    if (!infiniteData.length) return;
    scrollIndex.current = startIndex;
    const t = setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: scrollIndex.current * W, animated: false });
    }, 80);
    startAutoScroll();
    return () => { clearTimeout(t); stopAutoScroll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infiniteData.length, startIndex]);

  const startAutoScroll = () => {
    if (intervalRef.current || !infiniteData.length) return;
    intervalRef.current = setInterval(() => {
      if (!isPaused && !modalVisible && flatListRef.current) {
        scrollIndex.current += 1;
        flatListRef.current.scrollToOffset({ offset: scrollIndex.current * W, animated: true });
      }
    }, 3000);
  };
  const stopAutoScroll = () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };

  useEffect(() => { setIsPaused(modalVisible); }, [modalVisible]);

  /* === Modal ochish/yopish === */
  const openModal = (item) => {
    setSelectedItem(item);
    setModalVisible(true);
    setAspect(null);
    if (item?.imageUrl) {
      Image.getSize(
        item.imageUrl,
        (w, h) => setAspect(w && h ? w / h : null),
        () => setAspect(null)
      );
    }
  };
  const closeModal = () => { setModalVisible(false); setSelectedItem(null); setAspect(null); };

  /* === Karta (rasm + pastida matn) === */
  const renderItem = ({ item }) => (
    <View style={styles.page}>
      <Pressable onPress={() => openModal(item)} android_ripple={{ color: '#00000010' }} style={styles.card}>
        {/* RASM */}
        <View style={styles.imageWrap}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.noImage]}>
              <Text style={{ color: '#94a3b8' }}>No image</Text>
            </View>
          )}
        </View>

        {/* CAPTION — rasm ostida */}
        {!!item.title && (
          <View style={styles.captionBox}>
            <Text style={styles.captionText} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );

  if (loading) {
    return <View style={[styles.carouselContainer, styles.center]}><ActivityIndicator /></View>;
  }
  if (!news.length) {
    return <View style={[styles.carouselContainer, styles.center]}><Text style={{ color: '#6b7280' }}>Not available news</Text></View>;
  }

  // Modal rasm balandligi: agar aspect bor bo‘lsa W/aspect, bo‘lmasa contain fallback
  const modalImgStyle = aspect
    ? { width: W, height: Math.min(W / aspect, Math.round(H * 0.75)) }
    : { width: W, height: Math.round(H * 0.55) };

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        ref={flatListRef}
        data={infiniteData}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
        renderItem={renderItem}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
      />

      {/* FULLSCREEN MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalRoot}>
          <StatusBar barStyle="light-content" />
          <View style={styles.modalHeader}>
            <Pressable onPress={closeModal} style={styles.closeBtn} android_ripple={{ color: '#ffffff33' }}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            {selectedItem?.imageUrl ? (
              <Image
                source={{ uri: selectedItem.imageUrl }}
                style={[styles.modalImageBase, modalImgStyle]}
                resizeMode={aspect ? 'cover' : 'contain'}
              />
            ) : (
              <View style={[styles.modalImageBase, modalImgStyle, styles.noImage]}>
                <Text style={{ color: '#cbd5e1' }}>No image</Text>
              </View>
            )}

            {!!selectedItem?.title && (
              <View style={styles.modalBody}>
                <Text style={styles.modalTitle}>{selectedItem.title}</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },

  // Carousel konteyner balandligini yangi karta balandligiga moslaymiz
  carouselContainer: {
    height: CARD_H + CARD_V_SPACING * 2,
    backgroundColor: '#fff',
    marginVertical: 10,
  },

  // Har bir sahifa (FlatList paging uchun kengligi W bo‘lishi shart)
  page: {
    width: W,
    paddingHorizontal: 0,
    paddingVertical: CARD_V_SPACING,
  },

  // Karta – rasm yuqorida, matn pastda
  card: {
    width: W,
    alignSelf: 'center',
  },

  imageWrap: {
    width: W,
    height: IMAGE_H,
    paddingHorizontal: 16,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#0b0f17',
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },

  // Caption — rasm ostida oq kartada
  captionBox: {
    marginTop: 8,
    paddingHorizontal: 16,
    width: W,
  },
  captionText: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    lineHeight: 22,
    color: '#111827',
    elevation: 1,              // Android soyasi
    shadowColor: '#000',       // iOS soyasi
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    minHeight: CAPTION_MIN_H - 16, // (paddinglarni inobatga olgan holda)
  },

  /* ==== Modal ==== */
  modalRoot: { flex: 1, backgroundColor: '#0b0f17' },
  modalHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, alignItems: 'flex-end' },
  closeBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937'
  },
  closeText: { color: '#e5e7eb', fontSize: 16, fontWeight: '600' },
  modalScrollContent: { alignItems: 'center', paddingBottom: 24 },
  modalImageBase: { backgroundColor: '#0b0f17' },
  modalBody: { width: '100%', paddingHorizontal: 20, paddingTop: 16 },
  modalTitle: { color: '#e5e7eb', fontSize: 18, lineHeight: 26, fontWeight: '600' },
});

