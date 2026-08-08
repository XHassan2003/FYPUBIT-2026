import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { colors, gradients, gutter, inkAlpha, paperAlpha, spacing, type } from "@/constants/theme";
import { COLOR_QUIZ, COLOR_SEASONS, QuizOption, SeasonId, computeSeason } from "@/data/colorSeasons";
import { useWardrobe } from "@/store/useWardrobe";

const RESULT_IMAGE = require("@/assets/images/editorial/quiz-result.jpg");

export default function ColorQuizScreen() {
  const setColorSeason = useWardrobe((state) => state.setColorSeason);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizOption[]>([]);
  const [resultId, setResultId] = useState<SeasonId | null>(null);

  const question = COLOR_QUIZ[step];
  const result = resultId ? COLOR_SEASONS[resultId] : null;

  const progress = useSharedValue(0);
  useEffect(() => {
    const pct = resultId ? 100 : (step / COLOR_QUIZ.length) * 100;
    progress.value = withTiming(pct, { duration: 500 });
  }, [step, resultId, progress]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  const choose = (option: QuizOption) => {
    const next = [...answers.slice(0, step), option];
    setAnswers(next);
    if (step + 1 < COLOR_QUIZ.length) {
      setStep(step + 1);
      return;
    }
    const season = computeSeason(next);
    setColorSeason(season);
    setResultId(season);
  };

  const back = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setStep(step - 1);
  };

  return (
    <Screen
      variant="modal"
      header={
        <View style={styles.modalHeader}>
          <View style={styles.headerRow}>
            {result ? (
              <Text style={type.eyebrow}>Your result</Text>
            ) : (
              <Pressable
                onPress={back}
                accessibilityRole="button"
                accessibilityLabel={step === 0 ? "Close" : "Previous question"}
                hitSlop={8}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              >
                <Ionicons name="arrow-back" size={14} color={colors.smoke} />
                <Text style={[type.caps, styles.backLabel]}>{step === 0 ? "Close" : "Back"}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="close" size={20} color={inkAlpha.a70} />
            </Pressable>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
        </View>
      }
    >
      {result ? (
        <Animated.View entering={FadeIn.duration(500)}>
          <View style={styles.resultImageWrap}>
            <Image source={RESULT_IMAGE} style={styles.resultImage} contentFit="cover" transition={500} />
            <LinearGradient colors={gradients.paperFade} style={styles.resultFade} pointerEvents="none" />
          </View>

          <View style={styles.resultCopy}>
            <Text style={[type.eyebrow, styles.ash]}>Your season</Text>
            {/* "True Winter" splits so the qualifier sits upright and the season
                name drops to an italic second line. */}
            <Text style={[type.hero, styles.resultName]}>{result.name.split(" ")[0]}</Text>
            <Text style={[type.heroItalic, styles.resultNameItalic]}>
              {result.name.split(" ").slice(1).join(" ")}
            </Text>
            <Text style={[type.body, styles.resultLede]}>
              {result.tagline}. These are the colours that will do the most for you — and every wardrobe piece is now
              scored against them.
            </Text>
          </View>

          <View style={styles.paletteRow}>
            {result.palette.map((hex, index) => (
              <Animated.View
                key={hex}
                entering={FadeInDown.duration(450).delay(100 + index * 60)}
                style={[styles.paletteSwatch, { backgroundColor: hex }]}
              />
            ))}
          </View>

          <View style={styles.wearsBest}>
            <Text style={[type.eyebrow, styles.ash]}>Wears best in</Text>
            <View style={styles.tagRow}>
              {result.compatibleColorNames.map((name) => (
                <View key={name} style={styles.tag}>
                  <Text style={[type.caps, styles.tagLabel]}>{name}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.done}>
            <Button label="Done" onPress={() => router.back()} />
          </View>
        </Animated.View>
      ) : (
        <Animated.View key={question.id} entering={FadeInRight.duration(350)} style={styles.questionBlock}>
          <Text style={[type.eyebrow, styles.ash]}>
            Question {String(step + 1).padStart(2, "0")} / {String(COLOR_QUIZ.length).padStart(2, "0")}
          </Text>
          <Text style={[type.h2, styles.question]}>{question.question}</Text>

          <View style={styles.options}>
            {question.options.map((option, index) => (
              <Pressable
                key={option.label}
                onPress={() => choose(option)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              >
                <Text style={[type.h5, styles.optionLetter]}>{String.fromCharCode(65 + index)}</Text>
                <Text style={[type.bodyInk, styles.optionLabel]}>{option.label}</Text>
                <View style={styles.optionMark} />
              </Pressable>
            ))}
          </View>

          <Text style={[type.footnote, styles.footnote]}>There are no wrong answers — only your palette.</Text>
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ash: { color: colors.ash },
  pressed: { opacity: 0.7 },

  modalHeader: { backgroundColor: paperAlpha.a95 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: gutter,
    paddingVertical: spacing.lg,
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backLabel: { color: colors.smoke },
  progressTrack: { height: 1, backgroundColor: inkAlpha.a10 },
  progressFill: { height: 1, backgroundColor: colors.ink },

  resultImageWrap: { height: 210, width: "100%", overflow: "hidden" },
  resultImage: { width: "100%", height: "100%" },
  resultFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 96 },
  resultCopy: { marginTop: -40, paddingHorizontal: gutter },
  resultName: { marginTop: spacing.md, fontSize: 44, lineHeight: 42 },
  resultNameItalic: { fontSize: 44, lineHeight: 46 },
  resultLede: { marginTop: spacing.lg, maxWidth: 300 },

  paletteRow: { flexDirection: "row", marginTop: spacing.xxl, paddingHorizontal: gutter },
  paletteSwatch: { flex: 1, height: 64, borderWidth: 1, borderColor: inkAlpha.a8 },

  wearsBest: { marginTop: spacing.xl, paddingHorizontal: gutter },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  tag: { borderWidth: 1, borderColor: inkAlpha.a15, paddingHorizontal: spacing.md, paddingVertical: 6 },
  tagLabel: { color: colors.smoke },
  done: { marginTop: spacing.xxxl, paddingHorizontal: gutter },

  questionBlock: { paddingHorizontal: gutter, paddingTop: spacing.xxxl - spacing.sm },
  question: { marginTop: spacing.lg, fontSize: 32, lineHeight: 35 },
  options: { marginTop: spacing.xxxl - spacing.sm, borderTopWidth: 1, borderTopColor: inkAlpha.a10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: inkAlpha.a10,
    paddingVertical: spacing.xl - spacing.xs,
  },
  optionPressed: { backgroundColor: "rgba(21, 18, 14, 0.03)" },
  optionLetter: { fontSize: 12, lineHeight: 16, color: colors.ash },
  optionLabel: { flex: 1, fontSize: 15, lineHeight: 20 },
  optionMark: { width: 8, height: 8, borderWidth: 1, borderColor: inkAlpha.a25 },

  footnote: { marginTop: spacing.xxl, textAlign: "center" },
});
