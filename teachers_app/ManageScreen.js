// screens/ManageScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Appbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUser } from '../hooks/useUser'; // ✅ NAMED IMPORT

const { width: windowWidth } = Dimensions.get('window');

/* ---------- Data ---------- */
const categories = [
  { id: 'grammar', name: 'Grammar' },
  { id: 'ielts', name: 'IELTS' },
  { id: 'multilevel', name: 'Multilevel' },
];

const grammarLevels = [
  { level: 'Beginner and Elementary' },
  { level: 'Pre-Intermediate' },
  { level: 'Intermediate' },
  { level: 'Advanced' },
];

const ieltsLevels = [
  { level: 'IELTS LISTENING' },
  { level: 'IELTS READING' },
  { level: 'IELTS SPEAKING' },
  { level: 'IELTS WRITING' },
];

const listeningcategories = [
  { level: 'Listening Part 1' },
  { level: 'Listening Part 2' },
  { level: 'Listening Part 3' },
  { level: 'Listening Part 4' },
];
const readingcategories = [
  { level: 'Reading Passage 1' },
  { level: 'Reading Passage 2' },
  { level: 'Reading Passage 3' },
];
const speakingcategories = [
  { level: 'Speaking Part 1' },
  { level: 'Speaking Part 2' },
  { level: 'Speaking Part 3' },
];
const writingcategories = [
  { level: 'Writing Task 1' },
  { level: 'Writing Task 2' },
];

const multilevel = [
  { level: 'MULTI LEVEL LISTENING' },
  { level: 'MULTI LEVEL READING' },
  { level: 'MULT LEVEL SPEAKING' },
  { level: 'MULTI LEVEL WRITING' },
];
const multilevellisteningcategories = [
  { level: 'Listening Part 1' },
  { level: 'Listening Part 2' },
  { level: 'Listening Part 3' },
  { level: 'Listening Part 4' },
  { level: 'Listening Part 5' },
  { level: 'Listening Part 6' },
];
const multilevelreadingcategories = [
  { level: 'Reading Passage 1' },
  { level: 'Reading Passage 2' },
  { level: 'Reading Passage 3' },
  { level: 'Reading Passage 4' },
  { level: 'Reading Passage 5' },
];
const multilevelspeakingcategories = [
  { level: 'Speaking Part 1' },
  { level: 'Speaking Part 2' },
  { level: 'Speaking Part 3' },
];
const multilevelwritingcategories = [
  { level: 'Writing Task 1' },
  { level: 'Writing Task 2' },
  { level: 'Writing Task 3' },
];

/* ---------- Theme ---------- */
const CAT_META = {
  grammar:    { color: '#6366F1', light: '#EEF2FF', icon: 'book-open-variant' },
  ielts:      { color: '#059669', light: '#ECFDF5', icon: 'school' },
  multilevel: { color: '#F59E0B', light: '#FFFBEB', icon: 'layers-triple-outline' },
};
const SUB_ICONS = {
  listening: 'headphones',
  reading:   'book-open-page-variant',
  speaking:  'account-voice',
  writing:   'pencil',
};

/* ---------- Reusable Cards (FULL-WIDTH) ---------- */
function CategoryCard({ id, title, onPress }) {
  const meta = CAT_META[id] || CAT_META.grammar;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.cardFull, { backgroundColor: meta.light }]}>
      <View style={[styles.iconBadge, { backgroundColor: meta.color }]}>
        <MaterialCommunityIcons name={meta.icon} size={22} color="#fff" />
      </View>
      <Text style={[styles.cardTitle, { color: '#0F172A', flex: 1 }]} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.cardFooterInline}>
        <Text style={[styles.cardHint, { color: meta.color }]}>Select</Text>
        <MaterialCommunityIcons name="chevron-right" size={22} color={meta.color} />
      </View>
    </TouchableOpacity>
  );
}

function LevelCard({ title, accent = '#1349c7', leftIcon = 'layers-outline', onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.levelFullWrap}>
      <View style={[styles.levelLeftStrip, { backgroundColor: accent }]} />
      <View style={styles.levelContent}>
        <View style={[styles.levelIconCircle, { backgroundColor: `${accent}1A` }]}>
          <MaterialCommunityIcons name={leftIcon} size={18} color={accent} />
        </View>
        <Text style={styles.levelTitle} numberOfLines={2}>{title}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={accent} style={{ marginRight: 8 }} />
    </TouchableOpacity>
  );
}

/* ================== Screen ================== */
export default function ManageScreen() {
  const navigation = useNavigation();
  const { role, loading } = useUser();

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);

  const navigateToCreate = (category, level) => {
    navigation.navigate('CreateLesson', { category, level });
  };

  const renderLevels = (levels) => (
    <View style={styles.list}>
      {levels.map(({ level }) => {
        const meta = CAT_META[selectedCategory] || { color: '#1349c7' };
        let icon = 'layers-outline';
        if (selectedCategory === 'ielts') {
          if (level.includes('LISTENING')) icon = SUB_ICONS.listening;
          else if (level.includes('READING')) icon = SUB_ICONS.reading;
          else if (level.includes('SPEAKING')) icon = SUB_ICONS.speaking;
          else if (level.includes('WRITING')) icon = SUB_ICONS.writing;
        }
        return (
          <LevelCard
            key={level}
            title={level}
            accent={meta.color}
            leftIcon={icon}
            onPress={() => {
              if (selectedCategory === 'grammar') {
                navigateToCreate('grammar', level);
              } else {
                setSelectedLevel(level);
              }
            }}
          />
        );
      })}
    </View>
  );

  const renderSubLevels = (subs, accentColor, leftIcon = 'chevron-right') => (
    <View style={styles.list}>
      {subs.map(({ level }) => (
        <LevelCard
          key={level}
          title={level}
          accent={accentColor}
          leftIcon={leftIcon}
          onPress={() => navigateToCreate(selectedCategory, level)}
        />
      ))}
    </View>
  );

  const renderContent = () => {
    if (!selectedCategory) {
      return (
        <View style={styles.list}>
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              id={cat.id}
              title={cat.name}
              onPress={() => { setSelectedCategory(cat.id); setSelectedLevel(null); }}
            />
          ))}
        </View>
      );
    }

    if (selectedCategory === 'grammar') return renderLevels(grammarLevels);

    if (selectedCategory === 'ielts') {
      if (!selectedLevel) return renderLevels(ieltsLevels);
      const accent = CAT_META.ielts.color;
      if (selectedLevel === 'IELTS LISTENING')  return renderSubLevels(listeningcategories, accent, SUB_ICONS.listening);
      if (selectedLevel === 'IELTS READING')    return renderSubLevels(readingcategories,   accent, SUB_ICONS.reading);
      if (selectedLevel === 'IELTS SPEAKING')   return renderSubLevels(speakingcategories,  accent, SUB_ICONS.speaking);
      if (selectedLevel === 'IELTS WRITING')    return renderSubLevels(writingcategories,   accent, SUB_ICONS.writing);
      return null;
    }

    if (selectedCategory === 'multilevel') {
      if (!selectedLevel) return renderLevels(multilevel);
      const accent = CAT_META.multilevel.color;
      if (selectedLevel === 'MULTI LEVEL LISTENING') return renderSubLevels(multilevellisteningcategories, accent, SUB_ICONS.listening);
      if (selectedLevel === 'MULTI LEVEL READING')   return renderSubLevels(multilevelreadingcategories,    accent, SUB_ICONS.reading);
      if (selectedLevel === 'MULT LEVEL SPEAKING')   return renderSubLevels(multilevelspeakingcategories,   accent, SUB_ICONS.speaking);
      if (selectedLevel === 'MULTI LEVEL WRITING')   return renderSubLevels(multilevelwritingcategories,    accent, SUB_ICONS.writing);
      return null;
    }

    return null;
  };

  const getHeaderTitle = () => {
    if (!selectedCategory) return 'Manage Lessons';
    if (selectedCategory && !selectedLevel) return selectedCategory.toUpperCase();
    if (selectedLevel) return selectedLevel;
    return 'Manage Lessons';
  };

  const handleBack = () => {
    if (selectedLevel) setSelectedLevel(null);
    else if (selectedCategory) setSelectedCategory(null);
  };

  if (loading) return null;
  if (!(role === 'admin' || role === 'teacher')) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <Text>Only admin/teacher can upload lessons.</Text>
      </View>
    );
  }

  const crumbs = [
    { key: 'root',  label: 'All', active: !selectedCategory, onPress: () => { setSelectedCategory(null); setSelectedLevel(null); } },
    { key: 'cat',   label: selectedCategory ? selectedCategory.toUpperCase() : null, active: selectedCategory && !selectedLevel, onPress: () => { if (selectedCategory) setSelectedLevel(null); } },
    { key: 'level', label: selectedLevel, active: !!selectedLevel, onPress: () => {} },
  ].filter(x => !!x.label || x.key === 'root');

  const accent = selectedCategory ? (CAT_META[selectedCategory]?.color || '#1349c7') : '#1349c7';

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <Appbar.Header style={{ backgroundColor: accent }}>
        {(selectedCategory || selectedLevel) ? (
          <Appbar.BackAction color="#fff" onPress={handleBack} />
        ) : null}
        <Appbar.Content title={getHeaderTitle()} titleStyle={{ color: '#fff' }} />
      </Appbar.Header>

      {/* Breadcrumbs */}
      <View style={styles.crumbsWrap}>
        {crumbs.map((c, idx) => (
          <TouchableOpacity
            key={c.key}
            onPress={c.onPress}
            disabled={idx === crumbs.length - 1}
            style={[
              styles.crumbPill,
              { borderColor: accent, backgroundColor: idx === crumbs.length - 1 ? `${accent}1A` : '#fff' },
            ]}
          >
            <Text style={[styles.crumbText, { color: accent }]} numberOfLines={1}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {renderContent()}
      </ScrollView>
    </View>
  );
}

/* ================== Styles ================== */
const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: windowWidth < 400 ? 12 : 20,
    flexGrow: 1,
    gap: 12,
  },

  /* Breadcrumbs */
  crumbsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: windowWidth < 400 ? 12 : 20,
    paddingTop: 10,
    backgroundColor: '#F1F5F9',
  },
  crumbPill: {
    paddingVertical: Platform.OS === 'ios' ? 6 : 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  crumbText: { fontSize: 12, fontWeight: '700' },

  /* Full-width vertical list wrapper */
  list: { gap: 12 },

  /* Category card — FULL WIDTH */
  cardFull: {
    width: '100%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardFooterInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardHint: { fontSize: 12, fontWeight: '700' },

  /* Level card — FULL WIDTH */
  levelFullWrap: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  levelLeftStrip: { width: 4, height: '100%' },
  levelContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelIconCircle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  levelTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0F172A' },
});
