import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { colors, inkAlpha } from "@/constants/theme";

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

const TRACK_WIDTH = 46;
const KNOB = 18;
const INSET = 3;

/** Square switch — the knob slides between two hard stops, no rounding. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  const offset = useSharedValue(checked ? TRACK_WIDTH - KNOB - INSET - 1 : INSET);

  useEffect(() => {
    offset.value = withSpring(checked ? TRACK_WIDTH - KNOB - INSET - 1 : INSET, {
      stiffness: 520,
      damping: 34,
    });
  }, [checked, offset]);

  const knobStyle = useAnimatedStyle(() => ({ left: offset.value }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onChange}
      style={[styles.track, checked ? styles.trackOn : styles.trackOff]}
    >
      <Animated.View style={[styles.knob, checked ? styles.knobOn : styles.knobOff, knobStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_WIDTH, height: 26, borderWidth: 1, justifyContent: "center" },
  trackOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  trackOff: { backgroundColor: "transparent", borderColor: inkAlpha.a25 },
  knob: { position: "absolute", width: KNOB, height: KNOB },
  knobOn: { backgroundColor: colors.paper },
  knobOff: { backgroundColor: inkAlpha.a40 },
});
