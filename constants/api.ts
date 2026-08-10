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
