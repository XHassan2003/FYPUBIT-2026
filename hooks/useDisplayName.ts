import { useUser } from "@clerk/expo";
import { useWardrobe } from "@/store/useWardrobe";

/**
 * The name shown on Today and Profile.
 *
 * Clerk is the source of truth while someone is signed in: a Google account
 * arrives with first and last name already filled in, an email sign-up with the
 * username the form collected. The stored profile name is the last resort —
 * it seeds the demo wardrobe and is what every screen showed before accounts
 * existed.
 *
 * Deliberately derived rather than copied into the store. A copy would go stale
 * the moment someone signed out and back in as somebody else, and the store is
 * persisted, so the stale value would survive a restart.
 */
export function useDisplayName(): string {
  const { user } = useUser();
  const seeded = useWardrobe((state) => state.profile.name);

  return (
    user?.fullName?.trim() ||
    user?.firstName?.trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress.split("@")[0] ||
    seeded
  );
}
