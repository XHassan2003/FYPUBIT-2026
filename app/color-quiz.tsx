import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { colors, gradients, radii, spacing, type } from "@/constants/theme";
import { COLOR_QUIZ, COLOR_SEASONS, QuizOption, computeSeason } from "@/data/colorSeasons";
import { useWardrobe } from "@/store/useWardrobe";

export default function ColorQuizScreen() {
  const { setColorSeason } = useWardrobe();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizOption[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);

  const question = COLOR_QUIZ[step];
  const isLastStep = step === COLOR_QUIZ.length - 1;

  const choose = (option: QuizOption) => {
    const next = [...answers, option];
    if (isLastStep) {
      const season = computeSeason(next);
      setColorSeason(season);
      setResultId(season);
    } else {
      setAnswers(next);
      setStep(step + 1);
    }
  };

  if (resultId) {
    const season = COLOR_SEASONS[resultId as keyof typeof COLOR_SEASONS];
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultCard}>
            <Text style={styles.resultEyebrow}>YOUR COLOR DNA</Text>
            <Text style={styles.resultTitle}>{season.name}</Text>
            <Text style={styles.resultTagline}>{season.tagline}</Text>
          </LinearGradient>

          <Text style={[type.eyebrow, styles.paletteLabel]}>YOUR PALETTE</Text>
          <View style={styles.paletteRow}>
            {season.palette.map((hex) => (
              <View key={hex} style={[styles.swatch, { backgroundColor: hex }]} />
            ))}
          </View>

          <Button label="Done" onPress={() => router.back()} style={styles.done} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.content}>
        <Text style={type.small}>
          Question {step + 1} of {COLOR_QUIZ.length}
        </Text>
        <Text style={[type.h1, styles.question]}>{question.question}</Text>

        <View style={styles.options}>
          {question.options.map((option) => (
            <Pressable key={option.label} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]} onPress={() => choose(option)}>
              <Text style={type.bodyMedium}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl },
  question: { marginTop: spacing.sm },
  options: { marginTop: spacing.xl, gap: spacing.sm },
  option: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  optionPressed: { backgroundColor: colors.violetMuted, borderColor: colors.violet },
  resultContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  resultCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  resultEyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.onGradient,
    textTransform: "uppercase",
    opacity: 0.85,
  },
  resultTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 32, lineHeight: 38, color: colors.onGradient },
  resultTagline: { fontFamily: "Inter_400Regular", fontSize: 15, color: colors.onGradient, opacity: 0.9 },
  paletteLabel: { marginTop: spacing.xl },
  paletteRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  done: { marginTop: spacing.xxl },
});
