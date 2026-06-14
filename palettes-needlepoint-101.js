import { PALETTES } from "./palettes.js";

const FULL_RANGE = [
  ["001", "Canvas White", "#F8F3E8"], ["002", "Ivory", "#EFE3CD"], ["003", "Parchment", "#D8C8AD"],
  ["004", "Sand", "#C9A978"], ["005", "Gold", "#B8872F"], ["006", "Honey", "#D69B43"],
  ["007", "Apricot", "#E6A16E"], ["008", "Pumpkin", "#C76A28"], ["009", "Terra Cotta", "#A6502B"],
  ["010", "Chestnut", "#7A4728"], ["011", "Walnut", "#4E2F20"], ["012", "Espresso", "#241812"],
  ["013", "Black", "#080706"], ["014", "Pearl Gray", "#D1D0CB"], ["015", "Silver", "#B9BBB5"],
  ["016", "Pewter", "#858781"], ["017", "Charcoal", "#454642"], ["018", "Blush", "#EABDB7"],
  ["019", "Shell Pink", "#D99392"], ["020", "Rose", "#C76379"], ["021", "Cranberry", "#A92849"],
  ["022", "Garnet", "#671B2D"], ["023", "Scarlet", "#C52831"], ["024", "Coral", "#DE735F"],
  ["025", "Peach", "#F0B18D"], ["026", "Lemon", "#F4D95C"], ["027", "Marigold", "#E6A93A"],
  ["028", "Olive", "#697242"], ["029", "Moss", "#52613D"], ["030", "Sage", "#9EA785"],
  ["031", "Mint", "#A8D4BA"], ["032", "Emerald", "#26744F"], ["033", "Pine", "#173E2F"],
  ["034", "Aqua", "#79BFB8"], ["035", "Teal", "#24777A"], ["036", "Deep Sea", "#164B57"],
  ["037", "Sky", "#A8CBDD"], ["038", "French Blue", "#6B92B7"], ["039", "Denim", "#3E628B"],
  ["040", "Navy", "#162747"], ["041", "Periwinkle", "#9EA6D5"], ["042", "Lavender", "#B593C8"],
  ["043", "Violet", "#725498"], ["044", "Plum", "#613450"], ["045", "Orchid", "#C28ABE"],
  ["046", "Taupe", "#8E7B6A"], ["047", "Mocha", "#6D5748"], ["048", "Cocoa", "#5A3A2D"],
  ["049", "Warm Brown", "#9A6235"], ["050", "Rust", "#8B381E"], ["051", "Blue Black", "#151D29"],
  ["052", "Cream Yellow", "#F6E7A7"], ["053", "Leaf Green", "#7C9B5A"], ["054", "Slate Blue", "#586F86"]
];

const METALLIC = [
  ["001", "White Pearl", "#F8F4EA"], ["002", "Silver", "#C9CDD1"], ["003", "Pewter", "#8F9397"],
  ["004", "Gold", "#D4AF37"], ["005", "Antique Gold", "#B58A2B"], ["006", "Copper", "#B66A3C"],
  ["007", "Bronze", "#8A6A3A"], ["008", "Black", "#171717"], ["009", "Red", "#B71F32"],
  ["010", "Blue", "#285C9C"], ["011", "Emerald", "#1E7A50"], ["012", "Violet", "#6F4BA0"],
  ["013", "Opal", "#DDEDEA"], ["014", "Orange", "#D8732D"], ["015", "Pink", "#D784A6"]
];

const VELVET = [
  ["001", "Snow", "#F7F7F2"], ["002", "Ivory", "#EFE1C8"], ["003", "Camel", "#B98A55"],
  ["004", "Brown", "#6B422B"], ["005", "Chocolate", "#3B261B"], ["006", "Black", "#111111"],
  ["007", "Gray", "#80807B"], ["008", "Red", "#9D1F30"], ["009", "Rose", "#B75A6D"],
  ["010", "Orange", "#CB6A2A"], ["011", "Gold", "#B9892D"], ["012", "Green", "#3F6B40"],
  ["013", "Blue", "#385C88"], ["014", "Purple", "#5B3A73"], ["015", "Teal", "#2A7270"]
];

function prefixed(prefix, rows = FULL_RANGE) {
  return rows.map(([number, name, hex]) => [`${prefix}-${number}`, name, hex]);
}

const definitions = {
  essentials: ["Essentials", "18 mesh primary all-around thread. Good coverage, durable, beginner-friendly, and useful for backgrounds, large areas, and full projects.", prefixed("ES")],
  planet_earth_wool: ["Planet Earth Wool", "13 mesh wool option. Good for thicker coverage on larger mesh canvases and fast coverage areas.", prefixed("PEW")],
  splendor: ["Splendor Silk", "24 mesh fine silk option. Use for fine detail, smooth sheen, and delicate color work.", prefixed("SP")],
  soie_dalger: ["Soie d'Alger", "24 mesh fine silk option. Use for detailed work, faces, lettering, and delicate stitched areas.", prefixed("SA")],
  silk_lame_braid: ["Silk Lame Braid", "Specialty metallic/silk accent thread. Use sparingly for highlights, sparkle, and reflections.", prefixed("SL", METALLIC)],
  fyre_werks: ["Fyre Werks", "Specialty sparkle thread for reflections, shiny objects, water glints, glass, ornaments, and decorative highlights.", prefixed("FW", METALLIC)],
  petite_very_velvet: ["Petite Very Velvet", "Specialty texture thread for fur, snow, pillows, animals, plush objects, and raised texture areas.", prefixed("PVV", VELVET)],
  neon_rays_plus: ["Neon Rays+", "Specialty ribbon-like decorative thread for florals, bows, shiny accents, ornaments, and decorative stitches.", prefixed("NRP")]
};

for (const [id, [label, note, colors]] of Object.entries(definitions)) {
  PALETTES[id] = { id, label, note: `${note} Palette uses approximate screen hex values; replace with official color-card CSV for exact matching.`, colors };
}
