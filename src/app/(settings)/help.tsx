import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Timer,
  HelpCircle,
  Lightbulb,
  Footprints,
  Moon,
  Hand,
  TableOfContents,
  Palette,
  Columns3,
} from 'lucide-react-native';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';

// Enable LayoutAnimation on Android
// if (
//   Platform.OS === 'android' &&
//   UIManager.setLayoutAnimationEnabledExperimental
// ) {
//   UIManager.setLayoutAnimationEnabledExperimental(true);
// }

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How do I add audiobooks?',
    answer:
      'Open the settings menu, tap "Manage Library", then tap "Add Library Folder". Select a folder containing your audiobook files. Sonicbooks currently supports M4A, M4B, MP3 audio formats.',
  },
  {
    question: 'What audio formats are supported?',
    answer:
      'Sonicbooks supports M4A, M4B, and MP3. M4B files with embedded chapter markers are fully supported. More format support to come.',
  },
  {
    question: 'How does the sleep timer work?',
    answer:
      'Tap the bell icon in the player to toggle the sleep timer on/off. Long-press the bell to open timer settings where you can set the duration or number of chapters. The timer includes a fade-out feature for a smooth transition to silence.',
  },
  {
    question: 'How do auto-chapters work?',
    answer:
      'For audiobooks without embedded chapter markers, Sonicbooks can automatically generate chapters at regular intervals (30 or 60 minutes). Enable this in "Manage Library" settings.',
  },
  {
    question: 'What is Bedtime Mode?',
    answer:
      'Bedtime Mode automatically starts your sleep timer when you play audiobooks during your configured bedtime hours. Set your start and end times in Timer settings.',
  },
  {
    question: 'What are Footprints?',
    answer:
      'Footprints track your listening history - when you started, changed chapters, seeked, or used the sleep timer. Long-press the cover art in the player to view your footprints for the current book. Select a footprint to jump back to that point.',
  },
];

interface TipItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const HelpScreen = () => {
  const { colors: themeColors } = useTheme();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const toggleFAQ = useCallback((index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFAQ((prev) => (prev === index ? null : index));
  }, []);

  const tips: TipItem[] = [
    {
      icon: <Palette size={20} color={themeColors.primary} />,
      title: 'Customize the Accent Color',
      description:
        'Customize Sonicbooks by selecting your own accent color. Pick from the predefined colors, or enter in the hex code of your favorite color (eg "#ffffff")',
    },
    {
      icon: <Columns3 size={20} color={themeColors.primary} />,
      title: 'Change Display Size on Library Screen',
      description:
        'Choose the number of columns you want displayed on the Library screen when the section is expanded. 1 column shows book covers at full screen width, while 3 columns is much more compact.',
    },
    {
      icon: <Hand size={20} color={themeColors.primary} />,
      title: 'Long-press Cover Art in the Player',
      description:
        'View your listening history footprints for the current book. Select a footprint to jump to that timestamp',
    },
    {
      icon: <Footprints size={20} color={themeColors.primary} />,
      title: 'Footprints',
      description:
        'Track play presses, chapter switches, seeks, timer starts, and jump back to where you came from',
    },
    {
      icon: <Hand size={20} color={themeColors.primary} />,
      title: 'Long-press Book Details',
      description:
        'Long press on the book details page for quick access to edit book info. (does not work on press of the cover, the chapters section, or the play button)',
    },
    {
      icon: <TableOfContents size={20} color={themeColors.primary} />,
      title: 'Tap Chapters on Book Details',
      description:
        'Tap on the chapters section on the book details page to see the books chapters',
    },
    {
      icon: <Timer size={20} color={themeColors.primary} />,
      title: 'Long-press Timer Icon to Change, Tap to Toggle',
      description:
        'To change the timer you have set, long-press the bell icon to bring up the timer options screen. Once set, tap bell icon to toggle timer on/off. If no timer is set, a tap will bring up the options screen',
    },
    {
      icon: <Moon size={20} color={themeColors.primary} />,
      title: 'Bedtime Mode',
      description:
        'Automatically start sleep timer during your bedtime hours',
    },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <SettingsHeader title='Help' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* FAQ Section */}
        <SettingsCard title='Frequently Asked Questions' icon={HelpCircle}>
          <View style={styles.faqContent}>
            {FAQ_ITEMS.map((item, index) => (
              <View key={index}>
                <Pressable
                  onPress={() => toggleFAQ(index)}
                  style={[
                    styles.faqQuestion,
                    {
                      borderBottomColor: themeColors.divider,
                      borderBottomWidth:
                        index < FAQ_ITEMS.length - 1 &&
                        expandedFAQ !== index
                          ? StyleSheet.hairlineWidth
                          : 0,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.faqQuestionText,
                      { color: themeColors.text },
                    ]}
                  >
                    {item.question}
                  </Text>
                  {expandedFAQ === index ? (
                    <ChevronUp size={20} color={themeColors.textMuted} />
                  ) : (
                    <ChevronDown size={20} color={themeColors.textMuted} />
                  )}
                </Pressable>
                {expandedFAQ === index && (
                  <View
                    style={[
                      styles.faqAnswer,
                      {
                        borderBottomColor: themeColors.divider,
                        borderBottomWidth:
                          index < FAQ_ITEMS.length - 1
                            ? StyleSheet.hairlineWidth
                            : 0,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.faqAnswerText,
                        { color: themeColors.textMuted },
                      ]}
                    >
                      {item.answer}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </SettingsCard>

        {/* Tips Section */}
        <SettingsCard title='Tips & Gestures' icon={Lightbulb}>
          <View style={styles.tipsContent}>
            {tips.map((tip, index) => (
              <View
                key={index}
                style={[
                  styles.tipItem,
                  {
                    borderBottomColor: themeColors.divider,
                    borderBottomWidth:
                      index < tips.length - 1
                        ? StyleSheet.hairlineWidth
                        : 0,
                  },
                ]}
              >
                <View style={styles.tipIcon}>{tip.icon}</View>
                <View style={styles.tipText}>
                  <Text
                    style={[styles.tipTitle, { color: themeColors.text }]}
                  >
                    {tip.title}
                  </Text>
                  <Text
                    style={[
                      styles.tipDescription,
                      { color: themeColors.textMuted },
                    ]}
                  >
                    {tip.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </SettingsCard>
      </ScrollView>
    </View>
  );
};

export default HelpScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
  },
  scrollView: {},
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 40,
    flexGrow: 1,
  },
  sectionDescription: {
    fontFamily: 'Rubik',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 12,
  },
  toursContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  tourButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tourButtonText: {
    fontFamily: 'Rubik-Medium',
    fontSize: 15,
    flex: 1,
  },
  tourHint: {
    fontFamily: 'Rubik',
    fontSize: 12,
  },
  faqContent: {
    paddingHorizontal: 16,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  faqQuestionText: {
    fontFamily: 'Rubik-Medium',
    fontSize: 15,
    flex: 1,
    paddingRight: 12,
  },
  faqAnswer: {
    paddingBottom: 14,
  },
  faqAnswerText: {
    fontFamily: 'Rubik',
    fontSize: 14,
    lineHeight: 20,
  },
  tipsContent: {
    paddingHorizontal: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  tipIcon: {
    marginTop: 2,
  },
  tipText: {
    flex: 1,
  },
  tipTitle: {
    fontFamily: 'Rubik-Medium',
    fontSize: 15,
    marginBottom: 2,
  },
  tipDescription: {
    fontFamily: 'Rubik',
    fontSize: 14,
    lineHeight: 18,
  },
});
