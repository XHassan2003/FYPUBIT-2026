// Clerk configuration. The key is read from .env at build time — see
// .env.example for where to get it.
//
// Expo only inlines `process.env.X` written as a static dot-notation reference,
// so this must not be destructured or accessed with brackets.
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Fails loudly and early rather than letting Clerk throw something opaque three
 * screens later. Missing auth config is a setup mistake, not a runtime state to
 * handle.
 */
export function requirePublishableKey(): string {
  if (!publishableKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.\n\n" +
        "Copy .env.example to .env, paste your Clerk publishable key, and restart the dev server.\n" +
        "The key is at https://dashboard.clerk.com under API keys."
    );
  }
  return publishableKey;
}

/**
 * Clerk's v4 methods resolve with `{ error }` instead of throwing. The error's
 * shape is not narrowly typed, so read it defensively and always end up with
 * something worth showing a user.
 */
export function authErrorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (!error) return fallback;

  if (typeof error === "object") {
    // longMessage is Clerk's human-readable form ("Password must be at least
    // 8 characters"); message is the terser API string.
    const { longMessage, message } = error as { longMessage?: unknown; message?: unknown };
    if (typeof longMessage === "string" && longMessage) return longMessage;
    if (typeof message === "string" && message) return message;
  }

  return fallback;
}
