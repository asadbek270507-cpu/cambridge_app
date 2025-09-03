import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  ImageBackground,
} from "react-native";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { firestore } from "../../firebase"; // ✅ firestore o‘rniga db import qildik
import { doc, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import {
  Appbar,
  useTheme,
  MD3LightTheme,
  Provider as PaperProvider,
} from "react-native-paper";


const customTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#B71C1C",
    onPrimary: "#FFFFFF",
    background: "#fff",
    surface: "#fff",
    onSurface: "#000",
  },
};

function GrammarMaterialsContent({ route, navigation }) {
  const { level, category } = route.params || {};
  const collectionName = `${(category || "grammar").toLowerCase()}Materials`;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!level || !category) {
      setError("Level yoki category topilmadi.");
      setLoading(false);
      return;
    }

    const levelDocRef = doc(firestore, collectionName, level); // ✅ db ishlatyapmiz
    const lessonsColRef = collection(levelDocRef, "lessons");

    const q = query(lessonsColRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLoading(false);
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setLessons(data);
        setError(null);
      },
      (err) => {
        setLoading(false);
        setError(err.message || "Ma'lumotlarni olishda xato");
      }
    );

    return () => unsubscribe();
  }, [level, category]);

  const renderItem = ({ item, index }) => {
    const videoUrl = item.videoUrl || item.url || null;
    const comments = item.comment
      ? Array.isArray(item.comment)
        ? item.comment
        : [item.comment]
      : ["Kommentlar mavjud emas."];

    return (
      <TouchableOpacity
        style={styles.topicBox}
        onPress={() =>
          navigation.navigate("LessonMaterials", {
            videoUrl,
            comments,
            lessonTitle: item.title,
          })
        }
      >
        <Text style={styles.topicIndex}>{index + 1}.</Text>
        <View style={styles.topicContent}>
          <Text style={styles.topicTitle}>{item.title}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={lessons}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 16,
          paddingTop: 12,
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={{ marginTop: 20 }}
            />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Xato:</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.hintText}>
                Yo‘l: {collectionName}/{level}/lessons
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Hozircha {level} uchun darslar yo‘q.
            </Text>
          )
        }
      />
    </View>
  );
}

function GrammarMaterials({ route, navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ImageBackground
      source={require("../../assets/Cambridge_logo.png")}
      style={{ flex: 1 }}
      imageStyle={{ opacity: 0.1, resizeMode: "contain" }}
      resizeMode="contain"
    >
      <SafeAreaView
        style={{
          flex: 1,
          paddingTop:
            Platform.OS === "android" ? StatusBar.currentHeight : insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: "transparent",
        }}
      >
        <Appbar.Header
          style={{ backgroundColor: theme.colors.primary, elevation: 4 }}
        >
          <Appbar.BackAction
            onPress={() => navigation.goBack()}
            color={theme.colors.onPrimary}
          />
          <View style={styles.appbarContent}>
            <Image
              source={require("../../assets/Cambridge_logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Appbar.Content
              title="GRAMMAR MATERIALS"
              titleStyle={{
                color: theme.colors.onPrimary,
                fontWeight: "bold",
              }}
            />
          </View>
        </Appbar.Header>

        <GrammarMaterialsContent route={route} navigation={navigation} />
      </SafeAreaView>
    </ImageBackground>
  );
}

export default function GrammarMaterialsWrapper(props) {
  return (
    <PaperProvider theme={customTheme}>
      <GrammarMaterials {...props} />
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  appbarContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logo: {
    width: 30,
    height: 30,
    marginRight: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 24,
    color: "#333",
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  errorTitle: {
    fontWeight: "700",
    color: "#b91c1c",
    fontSize: 16,
  },
  errorText: {
    color: "#b91c1c",
    marginTop: 4,
    fontSize: 14,
  },
  hintText: {
    color: "#7f1d1d",
    marginTop: 8,
    fontStyle: "italic",
    fontSize: 12,
  },
  topicBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#eef6ff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
  },
  topicIndex: {
    width: 28,
    textAlign: "center",
    fontWeight: "700",
    color: "#8B0000",
    fontSize: 16,
  },
  topicContent: {
    flex: 1,
  },
  topicTitle: {
    fontWeight: "700",
    color: "#0f172a",
    fontSize: 16,
  },
});
