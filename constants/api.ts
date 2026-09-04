import Constants from "expo-constants";

// Connection details for the Python recommendation service (see service/).

const SERVICE_PORT = 8000;

/**
 * Explicit override, and it wins over everything else. Set it in a .env file
 * when the service is not on the same machine as the dev server — a deployed
 * instance, or a teammate hosting it:
 *
 *   EXPO_PUBLIC_API_URL=http://10.0.0.5:8000
 *
 * Must be read as a static `process.env.X` reference; Expo inlines it at build
 * time and destructuring or bracket access will not be replaced.
 */
const OVERRIDE = process.env.EXPO_PUBLIC_API_URL;

/**
 * Work out where the service is, without anyone hardcoding an IP.
 *
 * In development the app is served by Metro from the same machine that runs the
 * service, so Metro's own address is the one we want. `hostUri` looks like
 * "192.168.100.72:8081" and is only present while @expo/cli is serving the app.
 *
 * Returns undefined when there is nothing sensible to point at — a production
 * build with no override, or a tunnel, where the service is not reachable at
 * that host anyway. The store treats that as "unavailable" and styles the look
 * on-device instead.
 */
function resolveBaseUrl(): string | undefined {
  if (OVERRIDE) return OVERRIDE.replace(/\/+$/, "");

  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (!host) return undefined;

  return `http://${host}:${SERVICE_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

// How long to wait before giving up and styling the look on-device instead.
// Short on purpose: a laptop that is asleep or on another network should cost
// the user a moment, not a spinner that never resolves.
export const API_TIMEOUT_MS = 4000;

// Photo analysis gets its own, much longer budget. The four seconds above suit
// a local rules call; this one uploads an image and waits on Gemini, which
// takes a couple of seconds on its own. Reusing the short timeout would abort
// most successful analyses.
//
// There is also no fallback here to hurry back to — nothing on the device can
// read a photograph — so the honest choice is to wait, then say it failed.
export const ANALYSIS_TIMEOUT_MS = 25000;

// Virtual try-on gets longer still. It runs a diffusion model rather than
// reading an image, and the request is queued before it is run, so tens of
// seconds is the normal case. The screen says what it is doing throughout, so a
// long wait is a wait rather than a hang.
//
// A ceiling, not a target, and deliberately above the service's own budget
// (CLIENT_TIMEOUT_S in service/tryon.py, currently 240s) so the service gives up
// first and gets to explain why. If this were the shorter of the two the phone
// would abort a generation that was still running, and the user would be told
// nothing — **the two numbers have to be changed together**, and this one must
// stay the larger.
//
// Long, and deliberately so. Giving up does not cancel the job: it keeps running
// on fal and is billed either way, so a short ceiling spends the money and
// discards the result. Waiting is strictly better than aborting.
export const TRY_ON_TIMEOUT_MS = 270000;
