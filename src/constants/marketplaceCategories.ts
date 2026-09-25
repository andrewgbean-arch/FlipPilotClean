/**
 * The one list of marketplace categories.
 *
 * Every screen that offers, filters or displays a category reads it from here,
 * so the sell form, the hub grid and the browse filters can never drift apart.
 * Each category also carries the handful of things a buyer actually asks about
 * for that kind of item — a size for clothes, dimensions for furniture, whether
 * a phone is network locked — so the seller is only ever asked what is relevant.
 */

export type CategoryFieldType = "text" | "number" | "choice";

export type CategoryField = {
  /** Stored under listing.details[key]. */
  key: string;
  label: string;
  type: CategoryFieldType;
  /** For type "choice". The seller taps one. */
  options?: string[];
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  /** A line under the box explaining why it is asked, or what happens to the answer. */
  help?: string;
  /** Capital letters, for things like a registration number. */
  uppercase?: boolean;
};

export type MarketplaceCategory = {
  /** Stored on the listing. Never change one once listings exist. */
  id: string;
  label: string;
  /** Feather icon name. */
  icon: string;
  emoji: string;
  /** What older listings called this, so they still filter and display. */
  legacy?: string[];
  /** Words the photo AI might use for this kind of thing. */
  keywords: string[];
  fields: CategoryField[];
};

export const CONDITION_OPTIONS = [
  "New",
  "Like new",
  "Good",
  "Fair",
  "For parts / not working",
];

export const HANDOVER_OPTIONS = [
  "Collection only",
  "Post or courier",
  "Collection or post",
];

/** Asked for every listing, whatever it is. */
export const CONDITION_FIELD: CategoryField = {
  key: "condition",
  label: "Condition",
  type: "choice",
  options: CONDITION_OPTIONS,
  required: true,
};

export const HANDOVER_FIELD: CategoryField = {
  key: "handover",
  label: "Collection or delivery",
  type: "choice",
  options: HANDOVER_OPTIONS,
};

export const FAULTS_FIELD: CategoryField = {
  key: "faults",
  label: "Any faults or damage",
  type: "text",
  multiline: true,
  placeholder:
    "Marks, scratches, missing parts. Saying it up front saves an argument later.",
};

const YES_NO = ["Yes", "No"];

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  {
    id: "clothing",
    label: "Clothes & Shoes",
    icon: "shopping-bag",
    emoji: "👕",
    keywords: [
      "clothes", "clothing", "shoe", "trainer", "jacket", "coat", "dress",
      "shirt", "jeans", "trousers", "jumper", "hoodie", "boot", "handbag",
      "fashion", "apparel", "footwear",
    ],
    fields: [
      { key: "brand", label: "Brand", type: "text", placeholder: "e.g. Nike" },
      { key: "size", label: "Size", type: "text", required: true, placeholder: "e.g. UK 10, M, 32R" },
      { key: "colour", label: "Colour", type: "text" },
      { key: "material", label: "Material", type: "text", placeholder: "e.g. cotton, leather" },
    ],
  },
  {
    id: "furniture",
    label: "Furniture & Home",
    icon: "home",
    emoji: "🛋️",
    keywords: [
      "furniture", "sofa", "settee", "chair", "table", "desk", "bed",
      "wardrobe", "drawers", "cabinet", "bookcase", "mirror", "rug",
      "lamp", "curtain", "homeware", "cushion",
    ],
    fields: [
      { key: "dimensions", label: "Size (W x D x H)", type: "text", required: true, placeholder: "e.g. 200 x 90 x 85 cm" },
      { key: "material", label: "Material", type: "text", placeholder: "e.g. oak, fabric" },
      { key: "colour", label: "Colour", type: "text" },
      { key: "flatpack", label: "Comes apart for moving?", type: "choice", options: YES_NO },
    ],
  },
  {
    id: "phones",
    label: "Phones & Tablets",
    icon: "smartphone",
    emoji: "📱",
    keywords: ["phone", "iphone", "smartphone", "mobile", "tablet", "ipad", "galaxy"],
    fields: [
      { key: "brand", label: "Brand", type: "text", required: true, placeholder: "e.g. Apple" },
      { key: "model", label: "Model", type: "text", placeholder: "e.g. iPhone 13" },
      { key: "storage", label: "Storage", type: "text", placeholder: "e.g. 128GB" },
      { key: "networkLock", label: "Network", type: "choice", options: ["Unlocked", "Locked to a network", "Not sure"] },
      { key: "batteryHealth", label: "Battery health", type: "text", placeholder: "e.g. 89%" },
    ],
  },
  {
    id: "computers",
    label: "Computers & Laptops",
    icon: "monitor",
    emoji: "💻",
    keywords: ["laptop", "computer", "pc", "macbook", "desktop", "monitor", "printer", "keyboard"],
    fields: [
      { key: "brand", label: "Brand", type: "text", required: true, placeholder: "e.g. Dell" },
      { key: "model", label: "Model", type: "text" },
      { key: "spec", label: "Spec", type: "text", placeholder: "Processor, memory, storage" },
      { key: "screenSize", label: "Screen size", type: "text", placeholder: "e.g. 15.6 inch" },
    ],
  },
  {
    id: "tv-audio",
    label: "TV, Audio & Cameras",
    icon: "tv",
    emoji: "📺",
    keywords: ["tv", "television", "speaker", "soundbar", "headphone", "camera", "lens", "hi-fi", "stereo", "amplifier", "audio"],
    fields: [
      { key: "brand", label: "Brand", type: "text", required: true, placeholder: "e.g. Sony" },
      { key: "model", label: "Model", type: "text" },
      { key: "screenSize", label: "Screen size", type: "text", placeholder: "e.g. 50 inch" },
      { key: "accessories", label: "What comes with it", type: "text", placeholder: "Remote, cables, box" },
      { key: "tested", label: "Tested working?", type: "choice", options: ["Yes, tested", "Not tested"] },
    ],
  },
  {
    id: "gaming",
    label: "Games & Consoles",
    icon: "disc",
    emoji: "🎮",
    keywords: ["game", "console", "playstation", "ps5", "ps4", "xbox", "nintendo", "switch", "controller", "gaming"],
    fields: [
      { key: "platform", label: "Platform", type: "choice", required: true, options: ["PlayStation", "Xbox", "Nintendo", "PC", "Retro", "Other"] },
      { key: "edition", label: "Edition", type: "text", placeholder: "e.g. Digital, 1TB, Special Edition" },
      { key: "boxed", label: "Boxed?", type: "choice", options: YES_NO },
      { key: "accessories", label: "What comes with it", type: "text", placeholder: "Controllers, cables, games" },
    ],
  },
  {
    id: "electronics",
    label: "Other Electronics",
    icon: "cpu",
    emoji: "🔌",
    legacy: ["Electronics"],
    keywords: ["electronics", "electronic", "gadget", "charger", "smart watch", "drone", "e-reader"],
    fields: [
      { key: "brand", label: "Brand", type: "text", placeholder: "e.g. Anker" },
      { key: "model", label: "Model", type: "text" },
      { key: "tested", label: "Tested working?", type: "choice", options: ["Yes, tested", "Not tested"] },
      { key: "accessories", label: "What comes with it", type: "text", placeholder: "Cables, box, manual" },
    ],
  },
  {
    id: "appliances",
    label: "Home Appliances",
    icon: "zap",
    emoji: "🧺",
    keywords: ["appliance", "washing machine", "fridge", "freezer", "oven", "cooker", "dishwasher", "microwave", "vacuum", "kettle", "hoover"],
    fields: [
      { key: "brand", label: "Brand", type: "text", required: true, placeholder: "e.g. Bosch" },
      { key: "model", label: "Model", type: "text" },
      { key: "dimensions", label: "Size (W x D x H)", type: "text", placeholder: "e.g. 60 x 60 x 85 cm" },
      { key: "tested", label: "Tested working?", type: "choice", options: ["Yes, tested", "Not tested"] },
    ],
  },
  {
    id: "tools",
    label: "Tools & DIY",
    icon: "tool",
    emoji: "🛠️",
    legacy: ["Tools"],
    keywords: ["tool", "drill", "saw", "sander", "diy", "workbench", "ladder", "compressor", "spanner", "toolbox"],
    fields: [
      { key: "brand", label: "Brand", type: "text", placeholder: "e.g. Makita" },
      { key: "power", label: "Power", type: "choice", options: ["Cordless", "Corded", "Petrol", "Hand tool"] },
      { key: "includes", label: "What comes with it", type: "text", placeholder: "Battery, charger, case" },
    ],
  },
  {
    id: "garden",
    label: "Garden & Outdoor",
    icon: "sun",
    emoji: "🪴",
    keywords: ["garden", "lawn mower", "mower", "strimmer", "hedge", "greenhouse", "shed", "patio", "bbq", "plant", "outdoor"],
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "power", label: "Power", type: "choice", options: ["Petrol", "Electric", "Cordless", "Manual", "Not powered"] },
      { key: "dimensions", label: "Size", type: "text", placeholder: "e.g. 2 x 1.5 m" },
    ],
  },
  {
    id: "baby",
    label: "Baby & Kids",
    icon: "smile",
    emoji: "🍼",
    keywords: ["baby", "pram", "pushchair", "stroller", "cot", "car seat", "high chair", "nursery", "kids", "child"],
    fields: [
      { key: "brand", label: "Brand", type: "text", placeholder: "e.g. Maxi-Cosi" },
      { key: "ageRange", label: "Suitable for", type: "text", placeholder: "e.g. 0-6 months" },
      { key: "expiry", label: "Safety expiry date", type: "text", placeholder: "Car seats and similar — on the label" },
    ],
  },
  {
    id: "toys",
    label: "Toys & Games",
    icon: "gift",
    emoji: "🧸",
    keywords: ["toy", "lego", "puzzle", "board game", "doll", "figure", "playset", "teddy"],
    fields: [
      { key: "brand", label: "Brand", type: "text", placeholder: "e.g. LEGO" },
      { key: "ageRange", label: "Suitable for", type: "text", placeholder: "e.g. 3+" },
      { key: "complete", label: "All pieces there?", type: "choice", options: ["Complete", "Some pieces missing", "Not checked"] },
    ],
  },
  {
    id: "sports",
    label: "Sports & Leisure",
    icon: "activity",
    emoji: "⚽",
    keywords: ["sport", "bike", "bicycle", "golf", "gym", "weights", "treadmill", "fishing", "camping", "football", "ski"],
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "size", label: "Size", type: "text", placeholder: "e.g. frame 54cm, UK 9" },
    ],
  },
  {
    id: "jewellery",
    label: "Jewellery & Watches",
    icon: "watch",
    emoji: "💍",
    keywords: ["jewellery", "jewelry", "watch", "ring", "necklace", "bracelet", "earring", "gold", "silver"],
    fields: [
      { key: "brand", label: "Brand or maker", type: "text" },
      { key: "material", label: "Metal or material", type: "text", required: true, placeholder: "e.g. 9ct gold, sterling silver" },
      { key: "size", label: "Size", type: "text", placeholder: "e.g. ring size N, 18 inch chain" },
      { key: "boxedPapers", label: "Box and papers", type: "choice", options: ["Box and papers", "Box only", "Papers only", "Neither"] },
    ],
  },
  {
    id: "beauty",
    label: "Beauty & Health",
    icon: "droplet",
    emoji: "💄",
    keywords: ["beauty", "makeup", "perfume", "fragrance", "skincare", "hair", "cosmetic", "health", "supplement"],
    fields: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "sealed", label: "Sealed?", type: "choice", options: ["Sealed", "Opened, unused", "Used"] },
      { key: "expiry", label: "Use by", type: "text", placeholder: "If it is printed on the pack" },
    ],
  },
  {
    id: "books",
    label: "Books, Films & Music",
    icon: "book",
    emoji: "📚",
    legacy: ["Books"],
    keywords: ["book", "novel", "dvd", "blu-ray", "cd", "vinyl", "record", "film", "magazine", "comic"],
    fields: [
      { key: "format", label: "Format", type: "choice", required: true, options: ["Book", "Vinyl", "CD", "DVD", "Blu-ray", "Other"] },
      { key: "author", label: "Author or artist", type: "text" },
      { key: "edition", label: "Edition", type: "text", placeholder: "e.g. first edition, box set" },
    ],
  },
  {
    id: "instruments",
    label: "Musical Instruments",
    icon: "music",
    emoji: "🎸",
    keywords: ["guitar", "piano", "keyboard", "drum", "violin", "amp", "instrument", "bass", "saxophone"],
    fields: [
      { key: "brand", label: "Brand", type: "text", required: true, placeholder: "e.g. Fender" },
      { key: "model", label: "Model", type: "text" },
      { key: "caseIncluded", label: "Case included?", type: "choice", options: YES_NO },
    ],
  },
  {
    id: "collectibles",
    label: "Collectibles & Antiques",
    icon: "award",
    emoji: "🏺",
    legacy: ["Collectibles"],
    keywords: ["collectible", "antique", "vintage", "coin", "stamp", "medal", "memorabilia", "militaria", "china", "pottery"],
    fields: [
      { key: "maker", label: "Maker", type: "text", placeholder: "e.g. Royal Doulton" },
      { key: "era", label: "Year or period", type: "text", placeholder: "e.g. 1930s" },
      { key: "authenticity", label: "Marks or paperwork", type: "text", placeholder: "Hallmarks, signatures, certificates" },
    ],
  },
  {
    id: "pets",
    label: "Pet Supplies",
    icon: "heart",
    emoji: "🐾",
    keywords: ["pet", "dog", "cat", "aquarium", "fish tank", "hutch", "cage", "kennel", "vivarium"],
    fields: [
      { key: "petType", label: "For which pet", type: "text", required: true, placeholder: "e.g. dog, cat, small animal" },
      { key: "brand", label: "Brand", type: "text" },
      { key: "size", label: "Size", type: "text" },
    ],
  },
  {
    id: "motors",
    label: "Motors",
    icon: "truck",
    emoji: "🚗",
    legacy: ["Motors"],
    keywords: ["car", "van", "motorbike", "motorcycle", "motor", "vehicle", "caravan", "trailer", "scooter"],
    fields: [
      {
        key: "registration",
        label: "Registration",
        type: "text",
        required: true,
        placeholder: "e.g. AB12 CDE",
        uppercase: true,
        help: "We check it with the DVLA so buyers know it's a real car. Buyers never see your number plate.",
      },
      { key: "make", label: "Make", type: "text", required: true, placeholder: "e.g. Ford" },
      { key: "model", label: "Model", type: "text", required: true, placeholder: "e.g. Fiesta" },
      { key: "year", label: "Year", type: "number", placeholder: "e.g. 2015" },
      {
        key: "mileage",
        label: "Mileage",
        type: "number",
        required: true,
        placeholder: "e.g. 72000",
        help: "Buyers can compare it with the car's MOT record.",
      },
      { key: "fuel", label: "Fuel", type: "choice", options: ["Petrol", "Diesel", "Hybrid", "Electric", "Other"] },
      { key: "motExpiry", label: "MOT until", type: "text", placeholder: "e.g. March 2027" },
      { key: "serviceHistory", label: "Service history", type: "choice", options: ["Full", "Partial", "None"] },
    ],
  },
  {
    id: "other",
    label: "Everything Else",
    icon: "package",
    emoji: "📦",
    legacy: ["General", "Unknown"],
    keywords: ["other", "general", "misc", "miscellaneous"],
    fields: [],
  },
];

/** Every category by id, for quick lookups. */
const BY_ID = new Map(MARKETPLACE_CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string | null | undefined): MarketplaceCategory | null {
  if (!id) return null;
  return BY_ID.get(id) ?? matchCategory(id);
}

/** The label to show for whatever a listing has stored, old or new. */
export function categoryLabel(id: string | null | undefined): string {
  const known = getCategory(id);
  if (known) return known.label;
  return id && String(id).trim() ? String(id) : "Everything Else";
}

/**
 * A keyword counts only as a whole word, allowing for a plural. Matching on
 * any old substring files "category" under Pet Supplies, because it contains
 * "cat" — which is exactly the kind of wrong filing this is meant to prevent.
 */
function mentions(words: string[], keyword: string): boolean {
  return words.some(
    (w) => w === keyword || w === `${keyword}s` || w === `${keyword}es`
  );
}

/**
 * Best guess at the category for a free-text description — what the photo AI
 * called the item, or what an older listing stored. Returns null when nothing
 * matches, so the seller is asked rather than filed somewhere wrong.
 */
export function matchCategory(text: string | null | undefined): MarketplaceCategory | null {
  const needle = String(text ?? "").toLowerCase().trim();
  if (!needle) return null;

  for (const cat of MARKETPLACE_CATEGORIES) {
    if (cat.id === needle) return cat;
    if (cat.label.toLowerCase() === needle) return cat;
    if (cat.legacy?.some((l) => l.toLowerCase() === needle)) return cat;
  }

  const words = needle.split(/[^a-z0-9+]+/).filter(Boolean);

  // "Everything Else" has no meaningful keywords, so it is never a guess.
  for (const cat of MARKETPLACE_CATEGORIES) {
    if (cat.id === "other") continue;
    const hit = cat.keywords.some((k) =>
      k.includes(" ") ? needle.includes(k) : mentions(words, k)
    );
    if (hit) return cat;
  }

  return null;
}

/** The questions to ask for this category, in the order to ask them. */
export function fieldsFor(id: string | null | undefined): CategoryField[] {
  const cat = getCategory(id);
  return [CONDITION_FIELD, ...(cat?.fields ?? []), HANDOVER_FIELD, FAULTS_FIELD];
}

/** Which of those are still blank. */
export function missingRequiredFields(
  id: string | null | undefined,
  details: Record<string, string>
): CategoryField[] {
  return fieldsFor(id).filter((f) => f.required && !String(details[f.key] ?? "").trim());
}
