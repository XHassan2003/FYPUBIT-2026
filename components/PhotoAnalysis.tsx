import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors, gutter, inkAlpha, spacing, type } from "@/constants/theme";
import { GarmentAnalysis } from "@/store/useWardrobe";
import { Button } from "./Button";

/**
 * What the analyser made of the photograph, said out loud.
 *
 * The form fills itself in from this, which is the part worth being careful
 * about: fields changing on their own is unnerving unless something explains
 * why. So the reading is shown, and it says plainly that all of it is editable
 * — these are suggestions the user is free to overrule, not a verdict.
 *
 * The colour pair is the honest detail. It shows the colour actually seen in
 * the photograph beside the wardrobe swatch it was snapped to, and how far
 * apart they were, so a surprising "cream" can be checked rather than trusted.
 */

interface PhotoAnalysisProps {
  analysing: boolean;
  error: string | null;
  result: GarmentAnalysis | null;
  /** Absent when there is no photo left to try again with. */
  onRetry?: () => void;
}

export function PhotoAnalysis({ analysing, error, result, onRetry }: PhotoAnalysisProps) {
  if (analysing) return <Reading />;
  if (error) return <Failed message={error} onRetry={onRetry} />;

  // A reading that determined nothing is not worth a panel of its own — the
  // form is simply left as it was.
  const hasSomething = result && (result.name || result.category || result.color);
  if (!hasSomething) return null;

  return <Reader result={result} />;
}

/** Three plates breathing while the photo is read, as on Today. */
function Reading() {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.block}>
      <Text style={[type.eyebrow, styles.ash]}>Reading the photograph</Text>
      <View style={styles.plates}>
        {[0, 1, 2].map((index) => (
          <Plate key={index} index={index} />
        ))}
      </View>
      <Text style={[type.small, styles.readingNote]}>
        Naming the piece, judging its colour, and working out where you would wear it.
      </Text>
    </Animated.View>
  );
}

function Plate({ index }: { index: number }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    // Offset per plate so the row breathes rather than blinks, matching Today.
    opacity.value = withDelay(
      index * 180,
      withRepeat(withSequence(withTiming(0.85, { duration: 700 }), withTiming(0.4, { duration: 700 })), -1, false)
    );
  }, [opacity, index]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.plate, style]} />;
}

function Failed({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.block}>
      <View style={styles.failedHead}>
        <Ionicons name="alert-circle-outline" size={14} color={colors.ember} />
        <Text style={[type.eyebrow, styles.failedLabel]}>Could not read it</Text>
      </View>
      <Text style={[type.body, styles.failedMessage]}>{message}</Text>
      <Text style={[type.small, styles.ash]}>Fill the details in below — nothing is lost.</Text>
      {onRetry ? (
        <View style={styles.retry}>
          <Button label="Try again" variant="ghost" onPress={onRetry} />
        </View>
      ) : null}
    </Animated.View>
  );
}

function Reader({ result }: { result: GarmentAnalysis }) {
  const { name, category, occasions, colorName, color, detectedColor, deltaE } = result;

  return (
    <Animated.View entering={FadeInDown.duration(450)} style={styles.block}>
      <Text style={[type.eyebrow, styles.ash]}>Read from the photo</Text>

      {name ? <Text style={[type.h4, styles.name]}>{name}</Text> : null}

      {category || occasions.length > 0 ? (
        <Text style={[type.small, styles.meta]}>
          {[category, occasions.join(", ")].filter(Boolean).join("  ·  ")}
        </Text>
      ) : null}

      {color && colorName ? (
        <View style={styles.colorRow}>
          {/* Seen, then chosen. The arrow is the whole point: one is a
              measurement, the other is the wardrobe's own vocabulary. */}
          {detectedColor ? (
            <>
              <View style={[styles.chip, { backgroundColor: detectedColor }]} />
              <Ionicons name="arrow-forward" size={11} color={colors.ash} />
            </>
          ) : null}
          <View style={[styles.chip, { backgroundColor: color }]} />
          <Text style={[type.small, styles.colorLabel]}>
            {colorName}
            {detectedColor && deltaE !== undefined ? (
              <Text style={styles.ash}>{`   saw ${detectedColor.toLowerCase()}, ${deltaE} away`}</Text>
            ) : null}
          </Text>
        </View>
      ) : null}

      <View style={styles.rule} />
      <Text style={[type.small, styles.ash]}>
        Suggestions only. Change anything below and yours is what gets saved.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ash: { color: colors.ash },

  block: {
    marginTop: spacing.xl,
    marginHorizontal: gutter,
    borderWidth: 1,
    borderColor: inkAlpha.a10,
    backgroundColor: colors.sand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },

  plates: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  plate: { flex: 1, height: 3, backgroundColor: inkAlpha.a20 },
  readingNote: { marginTop: spacing.lg, maxWidth: 320 },

  failedHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  failedLabel: { color: colors.ember },
  failedMessage: { marginTop: spacing.md, color: colors.ink, maxWidth: 320 },
  retry: { marginTop: spacing.lg },

  name: { marginTop: spacing.md },
  meta: { marginTop: 6, textTransform: "capitalize" },

  colorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  chip: { width: 22, height: 22, borderWidth: 1, borderColor: inkAlpha.a15 },
  colorLabel: { marginLeft: spacing.xs, color: colors.ink, textTransform: "capitalize" },

  rule: { height: 1, backgroundColor: inkAlpha.a10, marginTop: spacing.xl, marginBottom: spacing.lg },
});
