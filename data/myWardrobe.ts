// Your own clothes, imported in bulk.
//
// Empty until you run the importer, which overwrites this whole file:
//
//   cd service && python tools/import_wardrobe.py <folder of photos>
//
// It reads each photograph through `/analyse` — the same endpoint Add Piece
// uses — so the name, category, colour and occasions are filled in for you.
// Editing the result afterwards is expected; re-running replaces it.
//
// ⚠️ **Not currently wired into the app.** Wardrobes are per-account now (see
// store/wardrobeSync.ts) — a file bundled into the app ships to every
// account, which is exactly what per-account sync exists to avoid. This tool
// still works for generating item data + resized photos locally, but nothing
// reads this file's output anymore. Pushing it straight to one account's
// database is the intended replacement; it needs its own design pass, mainly
// around a Clerk session token expiring (~60s) well inside a long per-photo
// analysis batch. Until then, treat this file as inert.
//
// **Why photograph your own rather than take a retailer's.** Product photos on
// Khaadi, Sapphire, J., Outfitters and the rest are those companies' copyrighted
// work, and shipping them in a submitted project is not defensible. Your own are
// also simply better input: a kameez laid flat or hung against a plain wall is
// the cleanest reference the model can get.

import type { WardrobeItem } from "./wardrobe";

export const myWardrobe: WardrobeItem[] = [];
