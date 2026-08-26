import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ConfirmStep,
  GeneratingStep,
  ItemStep,
  PhotoStep,
  ResultStep,
  Step,
  Toast,
  TryOnError,
  TryOnHeader,
} from "@/components/TryOnSteps";
import { colors, spacing } from "@/constants/theme";
import { Category, Occasion } from "@/data/mockWardrobe";
import { useTryOn } from "@/store/useTryOn";
import { useWardrobe } from "@/store/useWardrobe";

/**
 * Virtual try-on: your photo, your look, a last look at both, the wait, and
 * the result.
 *
 * The drawing is in components/TryOnSteps.tsx and the work is in
 * store/useTryOn.ts. What lives here is the order things happen in, and the
 * rule that nothing is generated until the person has seen exactly what is
 * about to be sent.
 *
 * The state is a store rather than local because Home shares it: a photo
 * chosen there is already chosen by the time this screen opens.
 */

/**
 * How long each line of the generating copy holds. The web build ticked every
 * 700ms, which suits a mocked result — a real generation runs tens of seconds,
 * and four lines that finish in three of them leave the screen frozen for the
 * rest of the wait.
 */
const STAGE_MS = 7000;

const TOAST_MS = 2400;

export default function TryOnScreen() {
  const params = useLocalSearchParams<{ item?: string; step?: string; occasion?: string }>();

  const wardrobe = useWardrobe((state) => state.items);
  const saveOutfit = useWardrobe((state) => state.saveOutfit);

  // Shared with Home, so a photo or a piece chosen there is already chosen here.
  const photo = useTryOn((state) => state.photo);
  const itemId = useTryOn((state) => state.itemId);
  const result = useTryOn((state) => state.result);
  const error = useTryOn((state) => state.error);
  const clearError = useTryOn((state) => state.clearError);
  const pickPhoto = useTryOn((state) => state.pickPhoto);
  const useSamplePhoto = useTryOn((state) => state.useSamplePhoto);
  const setItemId = useTryOn((state) => state.setItemId);
  const generate = useTryOn((state) => state.generate);
  const share = useTryOn((state) => state.share);
  const changePhoto = useTryOn((state) => state.changePhoto);

  // Home opens the flow at whichever step is still unanswered, but never past
  // something that is actually missing — a deep link with a stale step should
  // not land on a confirmation with no photo in it.
  const [step, setStep] = useState<Step>(() => {
    const requested = params.step as Step | undefined;
    if (requested === "result" && useTryOn.getState().result) return "result";
    if (requested === "confirm" && useTryOn.getState().photo && useTryOn.getState().itemId) return "confirm";
    if (requested === "item" && useTryOn.getState().photo) return "item";
    return "photo";
  });
  const [filter, setFilter] = useState<Category | "all">("all");
  const [stage, setStage] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Only pieces with a photograph: the generator works from images, and a
  // silhouette tells it nothing about the garment.
  const wearable = useMemo(() => wardrobe.filter((piece) => piece.image), [wardrobe]);
  const filtered = useMemo(
    () => (filter === "all" ? wearable : wearable.filter((piece) => piece.category === filter)),
    [wearable, filter]
  );
  const item = useMemo(() => wearable.find((piece) => piece.id === itemId), [wearable, itemId]);

  useEffect(() => {
    if (step !== "generating") return;
    setStage(0);
    const id = setInterval(() => setStage((prev) => Math.min(prev + 1, 3)), STAGE_MS);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const run = async () => {
    if (!item) return;
    setStep("generating");
    setSaved(false);
    setShowOriginal(false);

    const uri = await generate(item);
    // A failure drops back to the confirmation rather than a dead end, with
    // the photo and the piece still chosen so it is one tap to try again.
    setStep(uri ? "result" : "confirm");
  };

  const onSave = () => {
    if (!result || !item) return;
    const occasion = (params.occasion as Occasion) ?? item.occasions[0] ?? "casual";
    saveOutfit([item.id], occasion, result);
    setSaved(true);
    setToast("Saved to your looks");
  };

  const onShare = async () => {
    await share();
    setToast("Opening share…");
  };

  const onChangePhoto = () => {
    changePhoto();
    setSaved(false);
    setStep("photo");
  };

  const back = () => {
    if (step === "photo") router.back();
    else if (step === "item") setStep("photo");
    else if (step === "confirm") setStep("item");
    else if (step === "result") setStep("confirm");
    else setStep("confirm");
  };

  // The result owns the whole screen — no header, no scroll, no padding.
  if (step === "result" && result) {
    return (
      <View style={styles.dark}>
        <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
          <ResultStep
            image={result}
            photo={photo}
            showOriginal={showOriginal}
            onToggleOriginal={setShowOriginal}
            item={item}
            saved={saved}
            onBack={back}
            onSave={onSave}
            onShare={onShare}
            onAnotherOutfit={() => {
              setSaved(false);
              setStep("item");
            }}
            onChangePhoto={onChangePhoto}
            onRegenerate={run}
          />
        </SafeAreaView>
        {toast ? <Toast message={toast} /> : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <TryOnHeader step={step} onBack={back} onClose={() => router.back()} />

      {error ? <TryOnError message={error} onDismiss={clearError} /> : null}

      {step === "generating" ? (
        <GeneratingStep photo={photo} item={item} stage={stage} onCancel={() => setStep("confirm")} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {step === "photo" ? (
            <PhotoStep
              photo={photo}
              onPick={pickPhoto}
              onUseSample={useSamplePhoto}
              onContinue={() => setStep("item")}
            />
          ) : null}

          {step === "item" ? (
            <ItemStep
              items={filtered}
              filter={filter}
              onFilter={setFilter}
              selectedId={itemId}
              onSelect={setItemId}
              onContinue={() => setStep("confirm")}
              onAddPiece={() => router.push("/add-item")}
            />
          ) : null}

          {step === "confirm" && photo && item ? (
            <ConfirmStep
              photo={photo}
              item={item}
              onGenerate={run}
              onChangePiece={() => setStep("item")}
            />
          ) : null}
        </ScrollView>
      )}

      {toast ? <Toast message={toast} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  dark: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xxxl },
});
