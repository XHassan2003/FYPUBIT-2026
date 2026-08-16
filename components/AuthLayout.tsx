import { Image } from "expo-image";
import { CircleAlertIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react-native";
import { ReactNode, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, fonts, spacing } from "@/constants/theme";

/**
 * Everything the two auth screens need lives here: the editorial shell, the
 * field, and the submit button. Kept in one file on purpose — these parts are
 * only ever used by Sign In and Sign Up.
 */

const LOOK_CARD = require("@/assets/images/editorial/today-hero.jpg");
const FABRIC_CARD = require("@/assets/images/editorial/profile-cover.jpg");

interface AuthLayoutProps {
  /** Screen name for assistive tech — the web build's aria-label. */
  label: string;
  /** Newlines break the masthead across lines, as the design intends. */
  title: ReactNode;
  subtitle: string;
  badge?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

export function AuthLayout({
  label,
  title,
  subtitle,
  badge,
  children,
  footer,
  onBack,
  backLabel = "Use a different email",
}: AuthLayoutProps) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View
          accessibilityLabel={label}
          entering={FadeIn.duration(300)}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.container}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.wordmark}>ATELIER</Text>
                  <Text style={styles.wordmarkSub}>AI personal stylist</Text>
                </View>

                {/* Two garment cards, fanned. Decorative — hidden from readers. */}
                <View style={styles.cards} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Animated.View entering={FadeIn.duration(700)} style={styles.fabricCard}>
                    <Image source={FABRIC_CARD} style={styles.cardImage} contentFit="cover" />
                  </Animated.View>
                  <Animated.View entering={FadeIn.duration(700).delay(80)} style={styles.lookCard}>
                    <Image source={LOOK_CARD} style={styles.cardImage} contentFit="cover" />
                  </Animated.View>
                </View>
              </View>

              <View style={styles.rule} />

              <Animated.View entering={FadeInDown.duration(550).delay(60)} style={styles.intro}>
                {badge ? (
                  <View style={styles.badge}>
                    <SparklesIcon size={11} strokeWidth={1.7} color={auth.clay} />
                    <Text style={styles.badgeLabel}>{badge}</Text>
                  </View>
                ) : null}
                <Text style={[styles.title, badge ? styles.titleWithBadge : null]}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(550).delay(140)} style={styles.body}>
                {children}
              </Animated.View>

              {footer ? <View style={styles.footer}>{footer}</View> : null}

              {onBack ? (
                <Pressable onPress={onBack} style={styles.back} accessibilityRole="button">
                  {({ pressed }) => (
                    <Text style={[styles.backLabel, pressed && styles.backLabelPressed]}>{backLabel}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface AuthInputProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Centred display face with wide tracking — the verification code field. */
  center?: boolean;
}

export function AuthInput({ label, error, hint, center, secureTextEntry, ...inputProps }: AuthInputProps) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPassword = !!secureTextEntry;

  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldWrap}>
        <TextInput
          {...inputProps}
          secureTextEntry={isPassword && !revealed}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          placeholderTextColor={auth.taupeA50}
          selectionColor={auth.clay}
          accessibilityLabel={label}
          style={[
            styles.input,
            isPassword && styles.inputWithAction,
            center && styles.inputCentered,
            focused && styles.inputFocused,
            error ? styles.inputError : null,
            error && focused ? styles.inputErrorFocused : null,
          ]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={6}
            style={({ pressed }) => [styles.reveal, pressed && styles.revealPressed]}
          >
            {revealed ? (
              <EyeOffIcon size={16} strokeWidth={1.5} color={auth.taupe} />
            ) : (
              <EyeIcon size={16} strokeWidth={1.5} color={auth.taupe} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.fieldError}>
          <CircleAlertIcon size={12} strokeWidth={1.7} color={auth.alert} />
          <Text style={styles.fieldErrorLabel}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface AuthSubmitProps {
  label: string;
  busyLabel: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}

export function AuthSubmit({ label, busyLabel, onPress, busy, disabled }: AuthSubmitProps) {
  const off = !!disabled || !!busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: !!busy }}
      style={({ pressed }) => [
        styles.submit,
        pressed && !off && styles.submitPressed,
        off && styles.submitDisabled,
      ]}
    >
      {busy ? <AuthSpinner color={auth.espressoA35} /> : null}
      <Text style={[styles.submitLabel, off && styles.submitLabelDisabled]}>{busy ? busyLabel : label}</Text>
    </Pressable>
  );
}

/** The `animate-spin` loader, shared by the submit and the Google button. */
export function AuthSpinner({ color = auth.espresso, size = 15 }: { color?: string; size?: number }) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = 0;
    spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [spin]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  return (
    <Animated.View style={spinStyle}>
      <LoaderCircleIcon size={size} strokeWidth={2} color={color} />
    </Animated.View>
  );
}

/** Hairline rule with a centred label — separates the email form from SSO. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerRule} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerRule} />
    </View>
  );
}

/**
 * The alert and notice slabs the two screens share: a warm red for a failure,
 * linen for anything merely informational.
 */
export function AuthNotice({ message, tone = "info" }: { message: string; tone?: "error" | "info" }) {
  return (
    <View style={[styles.notice, tone === "error" ? styles.noticeError : styles.noticeInfo]}>
      <Text style={[styles.noticeLabel, tone === "error" ? styles.noticeLabelError : styles.noticeLabelInfo]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: auth.cream },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 40,
  },

  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.xl },
  wordmark: {
    marginTop: spacing.lg,
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 5.2,
    color: auth.espresso,
  },
  wordmarkSub: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 2.3,
    textTransform: "uppercase",
    color: auth.taupe,
  },

  cards: { position: "relative", height: 112, width: 104 },
  cardImage: { width: "100%", height: "100%" },
  fabricCard: {
    position: "absolute",
    right: 0,
    top: 8,
    height: 92,
    width: 70,
    borderRadius: auth.radius,
    overflow: "hidden",
    transform: [{ rotate: "7deg" }],
  },
  lookCard: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 108,
    width: 80,
    borderRadius: auth.radius,
    borderWidth: 1,
    borderColor: auth.cardEdge,
    overflow: "hidden",
    transform: [{ rotate: "-5deg" }],
    shadowColor: auth.espresso,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },

  rule: { marginTop: spacing.xxl, height: 1, width: "100%", backgroundColor: auth.espressoA10 },

  intro: { marginTop: spacing.xxl },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: auth.pill,
    backgroundColor: auth.linen,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  badgeLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: auth.clay,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 33,
    lineHeight: 37,
    letterSpacing: -0.17,
    color: auth.espresso,
  },
  titleWithBadge: { marginTop: spacing.lg },
  subtitle: {
    marginTop: spacing.md,
    maxWidth: 300,
    fontFamily: fonts.light,
    fontSize: 13.5,
    lineHeight: 21,
    color: auth.taupe,
  },

  body: { marginTop: 36, flex: 1 },
  footer: { marginTop: 36 },
  back: { marginTop: spacing.xl, alignSelf: "flex-start" },
  backLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: auth.taupe,
  },
  backLabelPressed: { color: auth.espresso },

  fieldLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: auth.taupe,
  },
  fieldWrap: { position: "relative", marginTop: 10 },
  input: {
    height: 54,
    width: "100%",
    borderRadius: auth.radius,
    borderWidth: 1,
    borderColor: auth.espressoA10,
    backgroundColor: auth.field,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: auth.espresso,
  },
  inputWithAction: { paddingRight: 48 },
  inputCentered: {
    textAlign: "center",
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 9.2,
  },
  // The web build's focus ring. iOS renders it as a soft clay halo; Android
  // gets the border alone rather than a drop shadow it would misread.
  inputFocused: {
    borderColor: auth.clay,
    ...Platform.select({
      ios: { shadowColor: auth.clay, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
      default: {},
    }),
  },
  inputError: { borderColor: auth.alertA50 },
  inputErrorFocused: {
    borderColor: auth.alert,
    ...Platform.select({
      ios: { shadowColor: auth.alert, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.28, shadowRadius: 4 },
      default: {},
    }),
  },
  reveal: {
    position: "absolute",
    right: spacing.md,
    top: 9,
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: auth.pill,
  },
  revealPressed: { backgroundColor: auth.linen },

  fieldError: { marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: 6 },
  fieldErrorLabel: { flex: 1, fontFamily: fonts.light, fontSize: 11.5, lineHeight: 16, color: auth.alert },
  fieldHint: {
    marginTop: spacing.sm,
    fontFamily: fonts.light,
    fontSize: 11.5,
    lineHeight: 16,
    color: auth.taupeA80,
  },

  submit: {
    height: 56,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: auth.pill,
    backgroundColor: auth.espresso,
  },
  submitPressed: { backgroundColor: auth.espressoPressed },
  submitDisabled: { backgroundColor: auth.espressoA12 },
  submitLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: auth.cream,
  },
  submitLabelDisabled: { color: auth.espressoA35 },

  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dividerRule: { flex: 1, height: 1, backgroundColor: auth.espressoA10 },
  dividerLabel: {
    fontFamily: fonts.regular,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: auth.taupe,
  },

  notice: { marginTop: spacing.lg, borderRadius: auth.radius, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  noticeError: { backgroundColor: auth.alertA08 },
  noticeInfo: { backgroundColor: auth.linen },
  noticeLabel: { fontFamily: fonts.light, fontSize: 12.5, lineHeight: 19 },
  noticeLabelError: { color: auth.alert },
  noticeLabelInfo: { color: auth.taupe },
});
