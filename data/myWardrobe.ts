// Your own clothes.
//
// Empty until you run the importer, which overwrites this whole file:
//
//   cd service && python tools/import_wardrobe.py <folder of photos>
//
// It reads each photograph through `/analyse` — the same endpoint Add Piece
// uses — so the name, category, colour and occasions are filled in for you.
// Editing the result afterwards is expected; re-running replaces it.
//
// These sit *alongside* the seeded demo wardrobe rather than replacing it. See
// SEED_WARDROBE in store/useWardrobe.ts, which unions both and reconciles them
// with whatever is already saved on the device.
//
// **Why photograph your own rather than take a retailer's.** Product photos on
// Khaadi, Sapphire, J., Outfitters and the rest are those companies' copyrighted
// work, and shipping them in a submitted project is not defensible. Your own are
// also simply better input: a kameez laid flat or hung against a plain wall is
// the cleanest reference the model can get, and it beats the editorial photographs
// in the seed wardrobe — which are the weakest garments in there precisely
// because they are pictures of people rather than pictures of clothes.

import type { WardrobeItem } from "./mockWardrobe";

export const myWardrobe: WardrobeItem[] = [];
