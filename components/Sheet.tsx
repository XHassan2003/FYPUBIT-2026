import { ReactNode, useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, inkAlpha, shadow, spacing } from "@/constants/theme";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SPRING = { stiffness: 340, damping: 36 };
/** Past this far down, or this fast, the release dismisses instead of springing back. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 700;

/**
 * Bottom sheet with a drag-to-dismiss handle. `rendered` outlives `open` so the
 * slide-out finishes before the Modal unmounts.
 */
export function Sheet({ open, onClose, children, label }: SheetProps) {
  const [rendered, setRendered] = useState(false);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const dragStart = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 240 }, (finished) => {
      if (finished) runOnJS(setRendered)(false);
    });
  }, [open, backdropOpacity, translateY]);

  useEffect(() => {
    if (!rendered || !open) return;
    translateY.value = SCREEN_HEIGHT;
    translateY.value = withSpring(0, SPRING);
    backdropOpacity.value = withTiming(1, { duration: 250 });
  }, [rendered, open, translateY, backdropOpacity]);

  // Only the grabber drags, so the sheet's own scrolling stays uncontested.
  const pan = Gesture.Pan()
    .onBegin(() => {
      dragStart.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, dragStart.value + event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  return (
    <Modal visible={rendered} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.container} accessibilityViewIsModal accessibilityLabel={label}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable style={styles.fill} accessibilityLabel="Close" onPress={onClose} />
          </Animated.View>

          <Animated.View style={[styles.sheet, sheetStyle]}>
            <GestureDetector gesture={pan}>
              <View style={styles.grabberArea}>
                <View style={styles.grabber} />
              </View>
            </GestureDetector>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: inkAlpha.a35,
  },
  fill: { flex: 1 },
  sheet: {
    maxHeight: "86%",
    backgroundColor: colors.paper,
    ...shadow.sheet,
  },
  // 12 above and 8 below the 3pt bar — a ~23pt strip to grab.
  grabberArea: { alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.sm },
  grabber: { width: 40, height: 3, backgroundColor: inkAlpha.a20 },
});
