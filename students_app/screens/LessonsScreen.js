// LessonsScreen.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PixelRatio,
  ImageBackground,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from 'react-native-paper';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size) => Math.round(PixelRatio.roundToNearestPixel(size * scale));
const RFValue = (fontSize) => {
  const standardScreenHeight = 680;
  const heightPercent = (fontSize * 100) / standardScreenHeight;
  const newSize = (heightPercent * SCREEN_HEIGHT) / 100;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export default function LessonsScreen({ navigation }) {
  const theme = useTheme();

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={[styles.mainContainer, { backgroundColor: theme.colors.background }]}>
      <CustomHeader
        title={
          <Text style={{ color: theme.colors.onPrimary, fontSize: RFValue(18), fontWeight: 'bold' }}>
            Darslar
          </Text>
        }
        onBackPress={handleGoBack}
        backgroundColor={theme.colors.primary}
        titleColor={theme.colors.onPrimary}
        iconColor={theme.colors.onPrimary}
      />

      <ImageBackground
        source={require('../../assets/Cambridge_logo.png')}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
        resizeMode="contain"
      >
        <View style={styles.contentContainer}>

          {/* GRAMMAR */}
          <TouchableOpacity onPress={() => navigation.navigate('GrammarScreen')}>
            <LinearGradient
              colors={['#4e54c8', '#8f94fb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.iconWrapper}>
                <FontAwesome5 name="book-open" size={normalize(20)} color="#fff" />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>GRAMMAR</Text>
                <Text style={styles.cardSubtitle}>Basic to advanced grammar lessons</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* MULTI LEVEL */}
          <TouchableOpacity onPress={() => navigation.navigate('MultiLevel')}>
            <LinearGradient
              colors={['#11998e', '#f95151ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.iconWrapper}>
                <FontAwesome5 name="layer-group" size={normalize(20)} color="#fff" />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>Multi Level</Text>
                <Text style={styles.cardSubtitle}>From Basics to Advanced</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* IELTS */}
          <TouchableOpacity onPress={() => navigation.navigate('IeltsScreen')}>
            <LinearGradient
              colors={['#fc4a1a', '#f7b733']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.iconWrapper}>
                <FontAwesome5 name="graduation-cap" size={normalize(20)} color="#fff" />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>IELTS</Text>
                <Text style={styles.cardSubtitle}>IELTS reading, listening, writing, speaking</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImageStyle: {
    opacity: 0.1,
    alignSelf: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: normalize(20),
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    padding: normalize(16),
    borderRadius: normalize(16),
    alignItems: 'center',
    marginBottom: normalize(20),
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  iconWrapper: {
    width: normalize(44),
    height: normalize(44),
    borderRadius: normalize(22),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: normalize(16),
  },
  cardText: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: RFValue(18),
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#f1f1f1',
    fontSize: RFValue(13),
    lineHeight: RFValue(16),
  },
});
