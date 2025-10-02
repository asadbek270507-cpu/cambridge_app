import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Appbar, MD3LightTheme, useTheme, Provider as PaperProvider } from 'react-native-paper';
import { collection, doc, orderBy, query, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../firebase';

// Android uchun LayoutAnimation yoqish
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental &&
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const customTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#B71C1C',
    accent: '#ffebd6ff',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    onPrimary: '#FFFFFF',
    onSurface: '#212121',
  },
};

export default function WritingScreen({ navigation }) {
  const theme = useTheme();
  const [openPartIndex, setOpenPartIndex] = useState(null);
  const [lessonsByPart, setLessonsByPart] = useState({});
  const [loadingPart, setLoadingPart] = useState(null);
  const unsubscribersRef = useRef({});

  const parts = [
    { title: 'Writing Task 1', id: 'Task 1' },
    { title: 'Writing Task 2', id: 'Task 2' },
  ];

  const handleGoBack = () => navigation.goBack();

  const togglePart = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (openPartIndex === index) {
      setOpenPartIndex(null);
      return;
    }

    setOpenPartIndex(index);

    const partKey = parts[index]?.id;
    const partTitle = parts[index]?.title;

    if (!partKey || !partTitle) return;

    if (!lessonsByPart[partKey]) {
      setLoadingPart(partKey);

      const partDocRef = doc(firestore, 'ieltsMaterials', partTitle);
      const lessonsColRef = collection(partDocRef, 'lessons');

      let qRef;
      try {
        qRef = query(lessonsColRef, orderBy('createdAt', 'asc'));
      } catch {
        qRef = query(lessonsColRef);
      }

      if (unsubscribersRef.current[partKey]) unsubscribersRef.current[partKey]();

      const unsubscribe = onSnapshot(
        qRef,
        (snapshot) => {
          const lessons = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setLessonsByPart((prev) => ({ ...prev, [partKey]: lessons }));
          setLoadingPart(null);
        },
        (error) => {
          console.error('Darslarni olishda xatolik:', error);
          setLoadingPart(null);
        }
      );

      unsubscribersRef.current[partKey] = unsubscribe;
    }
  };

  useEffect(() => {
    return () => {
      Object.values(unsubscribersRef.current).forEach((unsub) => {
        try { unsub && unsub(); } catch {}
      });
    };
  }, []);

  const renderLessons = (part) => {
    const lessons = lessonsByPart[part.id] ?? [];
    if (loadingPart === part.id) {
      return <ActivityIndicator size="small" color="#B71C1C" />;
    } else if (lessons.length > 0) {
      return lessons.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.lessonButton}
          onPress={() =>
            navigation.navigate('LessonMaterialsScreen', {
              partTitle: part.title,
              lessonId: item.id,
              lessonTitle: item.title ?? 'Untitled lesson',
              videoUrl: item.url ?? '',
              comments: item.comments ?? [],
            })
          }
        >
          <Text style={styles.lessonButtonText}>{item.title ?? 'Untitled lesson'}</Text>
        </TouchableOpacity>
      ));
    } else {
      return <Text style={styles.noLessonsText}>Hozircha darslar mavjud emas.</Text>;
    }
  };

  return (
    <PaperProvider theme={customTheme}>
      <ImageBackground
        source={require('../../assets/Cambridge_logo.png')}
        style={styles.backgroundImage}
        resizeMode="contain"
        imageStyle={{ opacity: 0.15 }}
      >
        <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
          <Appbar.BackAction onPress={handleGoBack} color={theme.colors.onPrimary} />
          <Appbar.Content
            title="IELTS WRITING"
            titleStyle={{ color: theme.colors.onPrimary, fontWeight: 'bold' }}
          />
        </Appbar.Header>

        <ScrollView contentContainerStyle={styles.container}>
          {parts.map((part, index) => (
            <View key={part.id} style={styles.partCard}>
              <TouchableOpacity style={styles.partHeader} onPress={() => togglePart(index)}>
                <Text style={styles.partTitle}>{part.title}</Text>
                <Text style={styles.arrow}>{openPartIndex === index ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {openPartIndex === index && (
                <View style={styles.lessonsContainer}>
                  {renderLessons(part)}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </ImageBackground>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1 },
  container: { padding: 20, paddingBottom: 50, flexGrow: 1 },
  partCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
  },
  partHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  partTitle: { fontSize: 18, fontWeight: '600' },
  arrow: { fontSize: 18 },
  lessonsContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  lessonButton: {
    backgroundColor: '#B71C1C',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  lessonButtonText: { color: '#fff', fontWeight: '500', fontSize: 16 },
  noLessonsText: {
    fontStyle: 'italic',
    color: '#999',
    textAlign: 'center',
    padding: 12,
  },
});
