// ─── Villa Templates Data ─────────────────────────────────────────────────
// Moved out of App.tsx — data should not live inside UI components.
// Add or remove villas here without touching any component file.

export interface VillaTemplate {
  name: string;
  address: string;
  bedrooms: number;
}

export const VILLA_TEMPLATES: VillaTemplate[] = [
  { name: 'Villa Serenity',    address: 'Jl. Raya Canggu No. 123, Bali',      bedrooms: 3 },
  { name: 'Villa Harmony',     address: 'Jl. Batu Bolong No. 45, Canggu',     bedrooms: 2 },
  { name: 'Villa Paradise',    address: 'Jl. Oberoi No. 10, Seminyak',         bedrooms: 4 },
  { name: 'Villa Ocean View',  address: 'Jl. Pantai Berawa No. 99, Canggu',   bedrooms: 5 },
  { name: 'Villa Tropical',    address: 'Jl. Umalas I No. 8, Kerobokan',      bedrooms: 3 },
  { name: 'Villa Sunset',      address: 'Jl. Petitenget No. 7, Seminyak',     bedrooms: 2 },
  { name: 'Villa Rice Field',  address: 'Jl. Pererenan No. 22, Mengwi',       bedrooms: 4 },
  { name: 'Villa Jungle',      address: 'Jl. Raya Ubud No. 88, Ubud',         bedrooms: 3 },
  { name: 'Villa Modern',      address: 'Jl. Mertanadi No. 55, Kerobokan',    bedrooms: 3 },
  { name: 'Villa Traditional', address: 'Jl. Hanoman No. 15, Ubud',           bedrooms: 2 },
];
