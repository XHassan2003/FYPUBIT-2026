import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors, gutter, inkAlpha, paperAlpha, spacing, type } from "@/constants/theme";
import { bodySlot, Category, TRY_ON_CATEGORIES, WardrobeItem } from "@/data/mockWardrobe";
import type { PhotoConcern } from "@/store/useTryOn";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { EmptyState } from "./EmptyState";
import { GarmentThumb } from "./GarmentThumb";

/**
 * The try-on's five steps.
 *
 * Kept in one file the way the auth screens are: these parts are only ever
 * used by app/try-on.tsx, and reading the flow top to bottom is more use than
 * five files that each make sense alone.
 */

export type Step = "photo" | "item" | "confirm" | "generating" | "result";

/** Generating and result both sit under the last marker — the bar tracks how
 *  far through the *choosing* you are, and choosing ends at confirm. */
const STEP_INDEX: Record<Step, number> = { photo: 0, item: 1, confirm: 2, generating: 2, result: 2 };

/**
 * Not styling advice — these are the model's requirements, in plain words.
 *
 * Try-on models want a catalogue shot of the wearer: one person, head to foot,
 * front on, plain background, in ordinary close-fitting clothes. A photo outside
 * that gives the model a poor read of the body, and that is what turns a shirt
 * into a shapeless smear. It is not a subtle effect — the same garment on a good
 * photo and a bad one produced a clean result in 11 seconds and a ruined one
 * in 64.
 *
 * These are about the photograph of *you*, and they did not change when the
 * model moved to FASHN v1.6. What FASHN relaxed is the garment side: a picture
 * of someone else wearing the item now works as a reference, where before it
 * had to be a flat-lay. That is a different image and none of these apply to it.
 *
 * Ordered by how much each actually changes the outcome, so someone who reads
 * only the first two still gets most of the benefit. The last is ordinary photo
 * advice rather than a hard requirement, which is why it is last.
 */
const TIPS = [
  "Stand in a full-length frame, head to feet.",
  "Face the camera, arms relaxed and away from your body.",
  "Keep the background plain — a bare wall reads best.",
  "Wear something close-fitting. A bulky coat has to be painted over.",
  "Even daylight. Avoid harsh shadows across the body.",
];

const STAGES = [
  "Reading your proportions",
  "Lifting the piece from your wardrobe",
  "Draping the fabric to your frame",
  "Matching the light and the shadow",
];

// --- chrome ----------------------------------------------------------------

export function TryOnHeader({ step, onBack, onClose }: { step: Step; onBack: () => void; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={19} color={inkAlpha.a70} />
        </Pressable>
        <Text style={type.eyebrow}>Virtual try-on</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={17} color={inkAlpha.a40} />
        </Pressable>
      </View>

      <View style={styles.progress}>
        {[0, 1, 2].map((index) => (
          <ProgressSegment key={index} filled={STEP_INDEX[step] >= index} />
        ))}
      </View>
    </View>
  );
}

function ProgressSegment({ filled }: { filled: boolean }) {
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, { duration: 400 });
  }, [fill, filled]);

  // Grown from the left rather than faded in, so the bar reads as progress
  // rather than as three lights coming on.
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, style]} />
    </View>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOut.duration(200)} style={styles.toast}>
      <Text style={styles.toastLabel}>{message}</Text>
    </Animated.View>
  );
}

// --- Step 1 — your photo ---------------------------------------------------

interface PhotoStepProps {
  photo?: string;
  onPick: (source: "camera" | "library") => void;
  onUseSample: () => void;
  onContinue: () => void;
}

export function PhotoStep({ photo, onPick, onUseSample, onContinue }: PhotoStepProps) {
  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.step}>
      <Text style={[type.eyebrow, styles.ash]}>Step one</Text>
      <Text style={[type.h1, styles.stepTitle]}>Your</Text>
      <Text style={[type.heroItalic, styles.stepTitleItalic]}>photo.</Text>
      {/* "The truest fit" is what this used to promise, and it was not true —
          colour and silhouette carry over, collars and buttons do not. What the
          result really turns on is the photograph, so point at the notes
          instead of overselling the outcome. */}
      <Text style={[type.body, styles.stepBlurb]}>
        Take a photo or choose one from your gallery. The result depends on the photograph more than
        anything else — the notes below are worth a moment.
      </Text>

      <View style={[styles.photoFrame, photo ? styles.photoFrameFilled : null]}>
        {photo ? (
          <>
            <Image source={{ uri: photo }} style={styles.photoImage} contentFit="cover" transition={400} />
            <View style={styles.photoBadge}>
              <Ionicons name="checkmark" size={10} color={colors.ink} />
              <Text style={styles.photoBadgeLabel}>Photo ready</Text>
            </View>
            <Pressable onPress={() => onPick("library")} style={styles.photoReplace}>
              <Text style={styles.photoReplaceLabel}>Replace</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.photoEmpty}>
            <Ionicons name="image-outline" size={22} color={colors.ash} />
            <Text style={[type.caps, styles.photoEmptyLabel]}>No photo yet</Text>
          </View>
        )}
      </View>

      <View style={styles.photoActions}>
        <View style={styles.photoAction}>
          <Button
            label="Take a photo"
            variant="secondary"
            onPress={() => onPick("camera")}
            icon={<Ionicons name="camera-outline" size={14} color={colors.ink} />}
          />
        </View>
        <View style={styles.photoAction}>
          <Button
            label="Gallery"
            variant="secondary"
            onPress={() => onPick("library")}
            icon={<Ionicons name="images-outline" size={14} color={colors.ink} />}
          />
        </View>
      </View>

      <Pressable onPress={onUseSample} style={styles.sample} hitSlop={6}>
        <Text style={styles.sampleLabel}>Use the sample photo instead</Text>
      </Pressable>

      <View style={styles.tips}>
        {TIPS.map((tip, index) => (
          <View key={tip} style={styles.tip}>
            <Text style={styles.tipIndex}>{String(index + 1).padStart(2, "0")}</Text>
            <Text style={[type.body, styles.tipText]}>{tip}</Text>
          </View>
        ))}
      </View>

      <View style={styles.stepAction}>
        <Button label="Continue" onPress={onContinue} disabled={!photo} />
      </View>
    </Animated.View>
  );
}

// --- Step 2 — your look ----------------------------------------------------

interface ItemStepProps {
  items: WardrobeItem[];
  filter: Category | "all";
  onFilter: (next: Category | "all") => void;
  selected: WardrobeItem[];
  onSelect: (item: WardrobeItem) => void;
  onContinue: () => void;
  onAddPiece: () => void;
}

/** What the current selection adds up to, in words, for the footer. */
function describeOutfit(selected: WardrobeItem[]): string {
  if (selected.length === 0) return "Nothing picked yet";
  if (selected.length === 1) {
    const only = selected[0];
    return bodySlot(only) === "whole" ? `${only.name} — a whole look` : only.name;
  }
  // Ordered for reading rather than for rendering: people say "shirt and
  // trousers", while the service runs the trousers first.
  const upper = selected.find((piece) => bodySlot(piece) === "upper");
  const lower = selected.find((piece) => bodySlot(piece) === "lower");
  return [upper?.name, lower?.name].filter(Boolean).join(" + ");
}

export function ItemStep({
  items,
  filter,
  onFilter,
  selected,
  onSelect,
  onContinue,
  onAddPiece,
}: ItemStepProps) {
  const selectedIds = new Set(selected.map((piece) => piece.id));

  return (
    <Animated.View entering={FadeIn.duration(320)}>
      <View style={styles.step}>
        <Text style={[type.eyebrow, styles.ash]}>Step two</Text>
        <Text style={[type.h1, styles.stepTitle]}>Choose your</Text>
        <Text style={[type.heroItalic, styles.stepTitleItalic]}>look.</Text>
        <Text style={[type.body, styles.stepBlurb]}>
          Everything here is already yours. Pick a top and a bottom for a whole outfit, or
          a single piece on its own.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        <Chip label="All" selected={filter === "all"} onPress={() => onFilter("all")} />
        {/* Not CATEGORIES: shoes and accessories are outside what the try-on
            model was trained on, so a chip for them would only ever lead to an
            empty list. See TRY_ON_CATEGORIES. */}
        {TRY_ON_CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={category}
            selected={filter === category}
            onPress={() => onFilter(category)}
          />
        ))}
      </ScrollView>

      {items.length === 0 ? (
        <EmptyState
          title={`No ${filter === "all" ? "pieces" : filter} to try`}
          message="Try-on needs a photograph to work from, and fits tops, bottoms and outerwear. Add a piece and it appears here."
          actionLabel="Add a piece"
          onAction={onAddPiece}
          style={styles.empty}
        />
      ) : (
        <View style={styles.cards}>
          {items.map((item, index) => (
            <ItemCard
              key={item.id}
              item={item}
              index={index}
              selected={selectedIds.has(item.id)}
              onPress={() => onSelect(item)}
            />
          ))}
        </View>
      )}

      <View style={styles.stickyFoot}>
        {/* Says what is picked, because with two selections the cards alone no
            longer make it obvious — and because picking a second top silently
            *replaces* the first rather than adding to it. Seeing the answer
            change is how that rule explains itself. */}
        <Text style={styles.outfitSummary} numberOfLines={1}>
          {describeOutfit(selected)}
        </Text>
        <Button label="Continue" onPress={onContinue} disabled={selected.length === 0} />
      </View>
    </Animated.View>
  );
}

function ItemCard({
  item,
  index,
  selected,
  onPress,
}: {
  item: WardrobeItem;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(500).delay(Math.min(index, 6) * 50)}>
      {/* The web build's ring-offset drawn as a gap: an outer border with
          padding, so the selected card is ringed rather than outlined. */}
      <View style={[styles.cardRing, selected && styles.cardRingOn]}>
        <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <GarmentThumb item={item} style={styles.cardImage} />
          <LinearGradient colors={["transparent", inkAlpha.a70]} style={styles.cardScrim} pointerEvents="none" />

          <View style={styles.cardFoot}>
            <View style={styles.cardCopy}>
              <Text style={[type.eyebrow, styles.cardEyebrow]} numberOfLines={1}>
                {item.brand ?? item.category}
              </Text>
              <Text style={[type.h3, styles.cardName]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.cardColorRow}>
                <View style={[styles.cardSwatch, { backgroundColor: item.color }]} />
                <Text style={styles.cardColorLabel}>
                  {item.colorName} · {item.category}
                </Text>
              </View>
            </View>

            {selected ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.cardSelected}>
                <Ionicons name="checkmark" size={11} color={colors.ink} />
                <Text style={styles.cardSelectedLabel}>Selected</Text>
              </Animated.View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// --- Step 3 — confirm ------------------------------------------------------

interface ConfirmStepProps {
  photo: string;
  items: WardrobeItem[];
  /** Something detectably wrong with the photo — see `assessPhoto`. */
  concern?: PhotoConcern;
  onGenerate: () => void;
  onChangePiece: () => void;
  onChangePhoto: () => void;
}

export function ConfirmStep({
  photo,
  items,
  concern,
  onGenerate,
  onChangePiece,
  onChangePhoto,
}: ConfirmStepProps) {
  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.step}>
      <Text style={[type.eyebrow, styles.ash]}>Step three</Text>
      <Text style={[type.h1, styles.stepTitle]}>Your</Text>
      <Text style={[type.heroItalic, styles.stepTitleItalic]}>look.</Text>

      {/* Deliberately a warning and not a block. The check reads width and
          height only, so it is confident about a landscape snapshot and blind
          to everything else — refusing to generate on that basis would stop
          people using photos that would have been fine. Gold rather than
          `ember`, which is the error colour and would overstate this. */}
      {concern ? (
        <Animated.View entering={FadeInDown.duration(320)} style={styles.concern}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.gold} />
          <View style={styles.concernBody}>
            <Text style={styles.concernHeadline}>{concern.headline}</Text>
            <Text style={[type.small, styles.concernAdvice]}>{concern.advice}</Text>
            <Pressable onPress={onChangePhoto} hitSlop={6}>
              <Text style={styles.concernAction}>Choose another photo</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.pair}>
        <View style={styles.pairYou}>
          <Image source={{ uri: photo }} style={styles.pairImage} contentFit="cover" transition={300} />
          <Text style={[type.eyebrow, styles.pairLabel]}>You</Text>
        </View>
        {/* Every chosen piece, not just the first. A two-piece outfit that
            showed one garment here would be confirming something other than
            what is about to be generated, which is the one thing this step
            exists to prevent. */}
        <View style={styles.pairItem}>
          <View style={styles.pairStack}>
            {items.map((piece) => (
              <GarmentThumb
                key={piece.id}
                item={piece}
                style={items.length > 1 ? styles.pairImageStacked : styles.pairImage}
              />
            ))}
          </View>
          <Text style={[type.eyebrow, styles.pairLabel]} numberOfLines={1}>
            {items.length > 1 ? `${items.length} pieces` : (items[0].brand ?? items[0].category)}
          </Text>
        </View>
        <View style={styles.pairPlus}>
          <Text style={styles.pairPlusLabel}>+</Text>
        </View>
      </View>

      <View style={styles.confirmDetail}>
        {items.map((piece) => (
          <View key={piece.id} style={styles.confirmPiece}>
            <Text style={type.h3}>{piece.name}</Text>
            <View style={styles.confirmMeta}>
              <View style={[styles.confirmSwatch, { backgroundColor: piece.color }]} />
              <Text style={styles.confirmMetaLabel}>{piece.colorName}</Text>
              <View style={styles.confirmDivider} />
              <Text style={styles.confirmMetaLabel}>{piece.category}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Said plainly, because it is the user's money. Each piece is a separate
          pass through the model — a whole outfit costs and waits twice over,
          and finding that out from the bill would be worse than reading it
          here. */}
      {items.length > 1 ? (
        <Text style={[type.small, styles.confirmCost]}>
          A full outfit is generated one piece at a time, so this takes about twice as long
          as a single garment.
        </Text>
      ) : null}

      <Text style={[type.heroItalic, styles.confirmQuestion]}>Ready to see yourself in it?</Text>

      <View style={styles.stepAction}>
        <Button
          label="Try it on"
          onPress={onGenerate}
          icon={<Ionicons name="sparkles-outline" size={14} color={colors.paper} />}
        />
      </View>

      <Pressable onPress={onChangePiece} style={styles.confirmSwap} hitSlop={6}>
        <Text style={styles.confirmSwapLabel}>
          {items.length > 1 ? "Change the pieces" : "Choose a different piece"}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// --- Step 4 — generating ---------------------------------------------------

export function GeneratingStep({
  photo,
  items,
  stage,
  slow,
  onCancel,
}: {
  photo?: string;
  items?: WardrobeItem[];
  stage: number;
  /** The wait has run past what a straightforward photo takes. */
  slow?: boolean;
  onCancel: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.step}>
      <View style={styles.scanFrame}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.scanImage} contentFit="cover" />
        ) : null}
        <ScanLine />
        {items && items.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.scanGarment}>
            {items.map((piece) => (
              <GarmentThumb key={piece.id} item={piece} style={styles.scanGarmentThumb} />
            ))}
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.generatingCopy}>
        <Text style={[type.h2, styles.generatingTitle]}>Creating your</Text>
        <Text style={[type.h2, styles.generatingTitleItalic]}>look…</Text>
        <Text style={[type.body, styles.generatingBlurb]}>
          Your personal stylist is putting everything together.
        </Text>

        <ProgressSweep />

        {/* Keyed so each stage animates in as its own element — a single line
            whose text swaps looks frozen on a wait this long. */}
        <View style={styles.stageSlot}>
          <Animated.Text key={stage} entering={FadeIn.duration(280)} style={styles.stageLabel}>
            {STAGES[Math.min(stage, STAGES.length - 1)]}
          </Animated.Text>
        </View>

        {/* The copy above runs out long before a difficult photo does, and a
            frozen line reads as a hung app. This says the quiet part instead:
            the wait itself is the signal, because the model takes far longer on
            a photograph it cannot read cleanly. Better to admit that at 45
            seconds than to let someone stare at "Matching the light" for four
            minutes and then hand them a failure. */}
        {slow ? (
          <Animated.Text entering={FadeIn.duration(400)} style={styles.generatingSlow}>
            Still working. This photo is taking longer than most — a full-length,
            front-on shot on a plain background is usually much quicker.
          </Animated.Text>
        ) : null}

        <Pressable onPress={onCancel} style={styles.cancel} hitSlop={8}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/** A band of light travelling down the photo, on a loop. */
function ScanLine() {
  const travel = useSharedValue(-0.3);

  useEffect(() => {
    travel.value = withRepeat(withTiming(1.3, { duration: 1600, easing: Easing.linear }), -1, false);
  }, [travel]);

  const style = useAnimatedStyle(() => ({ top: `${travel.value * 100}%` }));

  return (
    <Animated.View style={[styles.scanBand, style]} pointerEvents="none">
      <LinearGradient
        colors={["transparent", paperAlpha.a85, "transparent"]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/**
 * A bar that fills most of the way and stops. Honest: the generation gives no
 * progress to report, so this paces the wait rather than pretending to measure
 * it — and it never reaches the end, because arriving early and sitting there
 * reads worse than still moving.
 */
function ProgressSweep() {
  const width = useSharedValue(0.04);

  useEffect(() => {
    width.value = withTiming(0.96, { duration: 28000, easing: Easing.out(Easing.quad) });
  }, [width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={styles.sweepTrack}>
      <Animated.View style={[styles.sweepFill, style]} />
    </View>
  );
}

// --- Step 5 — result -------------------------------------------------------

interface ResultStepProps {
  image: string;
  photo?: string;
  showOriginal: boolean;
  onToggleOriginal: (showOriginal: boolean) => void;
  items?: WardrobeItem[];
  saved: boolean;
  /** Already copied into the phone's photo library. */
  savedToDevice: boolean;
  onBack: () => void;
  onSave: () => void;
  onSaveToDevice: () => void;
  onShare: () => void;
  onAnotherOutfit: () => void;
  onChangePhoto: () => void;
  onRegenerate: () => void;
}

export function ResultStep({
  image,
  photo,
  showOriginal,
  onToggleOriginal,
  items,
  saved,
  savedToDevice,
  onBack,
  onSave,
  onSaveToDevice,
  onShare,
  onAnotherOutfit,
  onChangePhoto,
  onRegenerate,
}: ResultStepProps) {
  const shown = showOriginal ? (photo ?? image) : image;

  return (
    <View style={styles.result}>
      <Animated.View key={showOriginal ? "original" : "result"} entering={FadeIn.duration(500)} style={StyleSheet.absoluteFill}>
        <Image source={{ uri: shown }} style={styles.resultImage} contentFit="cover" transition={400} />
      </Animated.View>

      <LinearGradient colors={[inkAlpha.a70, "transparent"]} style={styles.resultTopScrim} pointerEvents="none" />
      <LinearGradient
        colors={["transparent", inkAlpha.a70, colors.ink]}
        locations={[0, 0.45, 1]}
        style={styles.resultBottomScrim}
        pointerEvents="none"
      />

      <View style={styles.resultTop}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={paperAlpha.a85} />
        </Pressable>

        {/* Only offered when there is an original to compare against. */}
        {photo ? (
          <View style={styles.compare}>
            {[
              { label: "Look", value: false },
              { label: "You", value: true },
            ].map((option) => (
              <Pressable
                key={option.label}
                onPress={() => onToggleOriginal(option.value)}
                style={[styles.compareTab, showOriginal === option.value && styles.compareTabOn]}
              >
                <Text
                  style={[styles.compareLabel, showOriginal === option.value && styles.compareLabelOn]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <Animated.View entering={FadeInDown.duration(600).delay(150)} style={styles.resultFoot}>
        <Text style={[type.h1, styles.resultTitle]}>Your Atelier</Text>
        <Text style={[type.heroItalic, styles.resultTitleItalic]}>look.</Text>

        {/* One row per piece, so a full outfit credits both garments rather
            than naming whichever happened to be first. */}
        {(items ?? []).map((piece) => (
          <View key={piece.id} style={styles.resultItemRow}>
            <View style={[styles.resultSwatch, { backgroundColor: piece.color }]} />
            <Text style={styles.resultItemLabel}>
              <Text style={styles.resultItemName}>{piece.name}</Text>
              {` · ${piece.brand ?? piece.category}`}
            </Text>
          </View>
        ))}

        {/* Two saves, side by side, because they are genuinely different and
            the difference is not obvious from the words alone. "Save look"
            files it in the app's own Looks — app storage, gone when the app is.
            "To photos" copies the image into the phone's library, where it
            outlives the app entirely. That matters more than it sounds: the
            generated file itself sits in the cache directory, which the OS is
            free to empty whenever it likes, so this is the only one of the two
            that makes a look permanent. */}
        <View style={styles.resultSave}>
          <Pressable
            onPress={onSave}
            disabled={saved}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.saveButton,
              styles.saveButtonHalf,
              pressed && !saved && styles.pressed,
              saved && styles.saveButtonDone,
            ]}
          >
            <Ionicons
              name={saved ? "checkmark" : "bookmark-outline"}
              size={14}
              color={saved ? colors.smoke : colors.ink}
            />
            <Text style={[styles.saveLabel, saved && styles.saveLabelDone]} numberOfLines={1}>
              {saved ? "In your looks" : "Save look"}
            </Text>
          </Pressable>

          <Pressable
            onPress={onSaveToDevice}
            disabled={savedToDevice}
            accessibilityRole="button"
            accessibilityLabel="Save to your phone's photos"
            style={({ pressed }) => [
              styles.saveButton,
              styles.saveButtonHalf,
              pressed && !savedToDevice && styles.pressed,
              savedToDevice && styles.saveButtonDone,
            ]}
          >
            <Ionicons
              name={savedToDevice ? "checkmark" : "download-outline"}
              size={14}
              color={savedToDevice ? colors.smoke : colors.ink}
            />
            <Text
              style={[styles.saveLabel, savedToDevice && styles.saveLabelDone]}
              numberOfLines={1}
            >
              {savedToDevice ? "In your photos" : "To photos"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.resultRow}>
          {[
            { label: "Another outfit", icon: "sparkles-outline" as const, onPress: onAnotherOutfit },
            { label: "Change photo", icon: "camera-outline" as const, onPress: onChangePhoto },
            { label: "Share", icon: "share-outline" as const, onPress: onShare },
          ].map(({ label, icon, onPress }, index) => (
            <Pressable
              key={label}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [styles.resultAction, index > 0 && styles.resultActionDivided, pressed && styles.pressed]}
            >
              <Ionicons name={icon} size={15} color={paperAlpha.a85} />
              <Text style={styles.resultActionLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={onRegenerate} style={styles.regenerate} hitSlop={8}>
          <Ionicons name="refresh" size={12} color={paperAlpha.a60} />
          <Text style={styles.regenerateLabel}>Generate again</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// --- error -----------------------------------------------------------------

export function TryOnError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={styles.error}>
      <Ionicons name="alert-circle-outline" size={14} color={colors.ember} />
      <Text style={[type.small, styles.errorMessage]}>{message}</Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={14} color={colors.smoke} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ash: { color: colors.ash },
  pressed: { opacity: 0.85 },

  // chrome
  header: { borderBottomWidth: 1, borderBottomColor: inkAlpha.a10, backgroundColor: colors.paper },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  progress: { flexDirection: "row", gap: 4, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  progressTrack: { flex: 1, height: 2, backgroundColor: inkAlpha.a10, overflow: "hidden" },
  progressFill: { flex: 1, backgroundColor: colors.ink, transform: [{ scaleX: 0 }] },

  toast: {
    position: "absolute",
    bottom: spacing.xxl,
    alignSelf: "center",
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  toastLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.paper,
  },

  // shared step scaffolding
  step: { paddingHorizontal: gutter, paddingTop: spacing.xxl },
  stepTitle: { marginTop: spacing.md, fontSize: 36, lineHeight: 37 },
  stepTitleItalic: { fontSize: 36, lineHeight: 37 },
  stepBlurb: { marginTop: spacing.lg, maxWidth: 300 },
  stepAction: { marginTop: spacing.xxl },

  // step 1
  photoFrame: {
    marginTop: spacing.xxl,
    aspectRatio: 3 / 4,
    width: "100%",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: inkAlpha.a20,
    backgroundColor: colors.sand,
    overflow: "hidden",
  },
  photoFrameFilled: { borderStyle: "solid", borderColor: inkAlpha.a10 },
  photoImage: { width: "100%", height: "100%" },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  photoEmptyLabel: { marginTop: spacing.lg, color: colors.smoke },
  photoBadge: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: paperAlpha.a92,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  photoBadgeLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.ink,
  },
  photoReplace: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: paperAlpha.a92,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  photoReplaceLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.ink,
  },
  photoActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  photoAction: { flex: 1 },
  sample: { marginTop: spacing.lg, alignSelf: "flex-start" },
  sampleLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.ash,
    textDecorationLine: "underline",
  },

  tips: { marginTop: spacing.xxxl, borderTopWidth: 1, borderTopColor: inkAlpha.a10 },
  tip: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: inkAlpha.a8,
    paddingVertical: 14,
  },
  tipIndex: { fontFamily: type.h1.fontFamily, fontSize: 12, color: colors.ash },
  tipText: { flex: 1 },

  // step 2
  filterScroll: { marginTop: spacing.xl },
  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: gutter, paddingBottom: spacing.xs },
  empty: { marginTop: spacing.lg },
  cards: { marginTop: spacing.xl, paddingHorizontal: gutter, gap: spacing.xl },

  cardRing: { borderWidth: 1, borderColor: "transparent", padding: 3 },
  cardRingOn: { borderColor: colors.ink },
  card: { aspectRatio: 4 / 5, width: "100%", backgroundColor: colors.sand, overflow: "hidden" },
  cardImage: { width: "100%", height: "100%" },
  cardScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 128 },
  cardFoot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardCopy: { flex: 1, minWidth: 0 },
  cardEyebrow: { color: paperAlpha.a60 },
  cardName: { marginTop: 6, fontSize: 21, lineHeight: 24, color: colors.paper },
  cardColorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  cardSwatch: { width: 9, height: 9, borderWidth: 1, borderColor: paperAlpha.a50 },
  cardColorLabel: { fontFamily: type.body.fontFamily, fontSize: 11, color: paperAlpha.a60 },
  cardSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cardSelectedLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.ink,
  },

  stickyFoot: {
    marginTop: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: inkAlpha.a10,
    paddingHorizontal: gutter,
    paddingVertical: spacing.lg,
  },

  // step 3
  pair: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xxl },
  pairYou: { flex: 1.15 },
  pairItem: { flex: 1 },
  pairImage: { width: "100%", aspectRatio: 3 / 4, backgroundColor: colors.sand },
  pairLabel: { marginTop: 10, color: colors.ash },
  pairPlus: {
    position: "absolute",
    left: "50%",
    top: "36%",
    marginLeft: -16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  pairPlusLabel: { fontFamily: type.h1.fontFamily, fontSize: 15, color: colors.ink },

  confirmDetail: {
    marginTop: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: inkAlpha.a10,
    paddingTop: spacing.xl,
  },
  confirmMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 10 },
  confirmSwatch: { width: 10, height: 10, borderWidth: 1, borderColor: inkAlpha.a15 },
  confirmMetaLabel: { fontFamily: type.body.fontFamily, fontSize: 12, color: colors.smoke },
  confirmDivider: { width: 1, height: 12, backgroundColor: inkAlpha.a15 },
  confirmQuestion: { marginTop: spacing.xxxl, fontSize: 19, lineHeight: 24, textAlign: "center" },
  confirmSwap: { marginTop: spacing.lg, alignSelf: "center" },
  confirmSwapLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.ash,
  },

  // step 4
  scanFrame: {
    alignSelf: "center",
    marginTop: spacing.lg,
    width: "76%",
    aspectRatio: 3 / 4,
    backgroundColor: colors.sand,
    overflow: "hidden",
  },
  scanImage: { width: "100%", height: "100%", opacity: 0.4 },
  scanBand: { position: "absolute", left: 0, right: 0, height: 96 },
  scanGarment: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    width: 54,
    height: 72,
    borderWidth: 1,
    borderColor: colors.paper,
    overflow: "hidden",
  },
  scanGarmentThumb: { width: "100%", height: "100%" },

  generatingCopy: { marginTop: spacing.xxxl, alignItems: "center" },
  generatingTitle: { textAlign: "center" },
  generatingTitleItalic: { fontFamily: type.heroItalic.fontFamily, textAlign: "center" },
  generatingBlurb: { marginTop: spacing.md, maxWidth: 280, textAlign: "center" },
  sweepTrack: { width: "100%", height: 2, backgroundColor: inkAlpha.a10, marginTop: spacing.xl },
  sweepFill: { height: "100%", backgroundColor: colors.ink },
  stageSlot: { height: 20, marginTop: spacing.lg, justifyContent: "center" },
  stageLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 11,
    letterSpacing: 1.9,
    textTransform: "uppercase",
    color: colors.smoke,
    textAlign: "center",
  },
  cancel: { marginTop: spacing.xxl },
  cancelLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.ash,
  },

  // step 5
  result: { flex: 1, backgroundColor: colors.ink },
  resultImage: { width: "100%", height: "100%" },
  resultTopScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 128 },
  resultBottomScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "56%" },
  resultTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  compare: { flexDirection: "row", borderWidth: 1, borderColor: paperAlpha.a50 },
  compareTab: { paddingHorizontal: 14, paddingVertical: spacing.sm },
  compareTabOn: { backgroundColor: colors.paper },
  compareLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: paperAlpha.a85,
  },
  compareLabelOn: { color: colors.ink },

  resultFoot: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: gutter, paddingBottom: spacing.xxl },
  resultTitle: { fontSize: 38, lineHeight: 38, color: colors.paper },
  resultTitleItalic: { fontSize: 38, lineHeight: 40, color: colors.paper },
  resultItemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  resultSwatch: { width: 10, height: 10, borderWidth: 1, borderColor: paperAlpha.a50 },
  resultItemLabel: { flex: 1, fontFamily: type.body.fontFamily, fontSize: 12.5, color: paperAlpha.a60 },
  resultItemName: { color: colors.paper },

  // Two buttons where there was one, so the row splits the width between them.
  resultSave: { marginTop: spacing.xl, flexDirection: "row", gap: spacing.md },
  saveButtonHalf: { flex: 1 },
  saveButton: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.paper,
  },
  saveButtonDone: { backgroundColor: paperAlpha.a50 },
  saveLabel: {
    fontFamily: type.capsButton.fontFamily,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.ink,
  },
  saveLabelDone: { color: colors.smoke },

  resultRow: {
    flexDirection: "row",
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: paperAlpha.a50,
    paddingTop: spacing.lg,
  },
  resultAction: { flex: 1, alignItems: "center", gap: spacing.sm },
  resultActionDivided: { borderLeftWidth: 1, borderLeftColor: paperAlpha.a50 },
  resultActionLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: paperAlpha.a60,
  },

  regenerate: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl },
  regenerateLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: paperAlpha.a60,
  },

  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: gutter,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.sand,
    borderWidth: 1,
    borderColor: inkAlpha.a10,
  },
  errorMessage: { flex: 1, color: colors.ink },

  // The photo warning on step three. Shaped like `error` above so the two read
  // as the same kind of object, but on paper rather than sand and keyed to gold
  // rather than ember — this is advice, not a failure, and the colours are what
  // carry that distinction before the words are read.
  concern: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: inkAlpha.a10,
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
  },
  concernBody: { flex: 1, gap: spacing.xs },
  concernHeadline: { fontFamily: type.h3.fontFamily, fontSize: 14, color: colors.ink },
  concernAdvice: { color: colors.smoke },
  // Two garments side by side where there used to be one. Each takes an equal
  // share of the width, and keeping the aspect ratio means the row stays the
  // same height as the "You" panel beside it whether it holds one piece or two.
  pairStack: { flexDirection: "row", gap: spacing.xs },
  pairImageStacked: {
    flex: 1,
    aspectRatio: 3 / 4,
    backgroundColor: colors.sand,
  },

  outfitSummary: {
    marginBottom: spacing.md,
    textAlign: "center",
    fontFamily: type.body.fontFamily,
    fontSize: 12,
    color: colors.smoke,
  },

  confirmPiece: { marginBottom: spacing.md },
  confirmCost: {
    marginTop: spacing.lg,
    maxWidth: 300,
    alignSelf: "center",
    textAlign: "center",
    color: colors.smoke,
  },

  generatingSlow: {
    marginTop: spacing.lg,
    maxWidth: 300,
    textAlign: "center",
    alignSelf: "center",
    fontFamily: type.body.fontFamily,
    fontSize: 12,
    lineHeight: 18,
    color: colors.smoke,
  },

  concernAction: {
    marginTop: spacing.xs,
    fontFamily: type.caps.fontFamily,
    fontSize: type.caps.fontSize,
    letterSpacing: type.caps.letterSpacing,
    textTransform: "uppercase",
    color: colors.ink,
    textDecorationLine: "underline",
  },
});
