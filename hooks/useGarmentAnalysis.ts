import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useCallback, useState } from "react";
import { GarmentAnalysis, useWardrobe } from "@/store/useWardrobe";

/**
 * Turn a picked photo into filled-in form fields.
 *
 * The screen only needs `analyse(uri)` and the two flags — everything about
 * resizing, encoding and talking to the service lives here, so Add Piece can be
 * restyled or rebuilt without touching any of it.
 */

/**
 * Gemini bills images in 768px tiles, so a 4000px phone photo costs more,
 * uploads slower, and tells the model nothing extra about what a garment is.
 * Long edge only — the aspect ratio follows.
 */
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.7;

export function useGarmentAnalysis() {
  const analyseGarment = useWardrobe((state) => state.analyseGarment);

  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const analyse = useCallback(
    async (uri: string): Promise<GarmentAnalysis | null> => {
      setAnalysing(true);
      setError(null);

      try {
        const context = ImageManipulator.manipulate(uri);
        context.resize({ width: MAX_EDGE });

        const rendered = await context.renderAsync();
        const resized = await rendered.saveAsync({
          format: SaveFormat.JPEG,
          compress: JPEG_QUALITY,
          base64: true,
        });

        if (!resized.base64) {
          setError("Could not read that photo. Fill the details in below.");
          return null;
        }

        const outcome = await analyseGarment(resized.base64, "image/jpeg");
        if (!outcome.ok) {
          setError(outcome.message);
          return null;
        }

        return outcome.analysis;
      } catch (err) {
        // Resizing can fail on a file the picker handed us but the OS cannot
        // decode. Nothing to retry, so say so and let the form be filled by hand.
        console.warn("[stylist] could not prepare the photo for analysis:", err);
        setError("Could not read that photo. Fill the details in below.");
        return null;
      } finally {
        setAnalysing(false);
      }
    },
    [analyseGarment]
  );

  return { analyse, analysing, error, clearError };
}
