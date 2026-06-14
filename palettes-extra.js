import { PALETTES } from "./palettes.js";

const BASE = [
  ["001", "Canvas White", "#F8F3E8"],
  ["002", "Ivory", "#EFE3CD"],
  ["003", "Parchment", "#D8C8AD"],
  ["004", "Sand", "#C9A978"],
  ["005", "Gold", "#B8872F"],
  ["006", "Honey", "#D69B43"],
  ["007", "Apricot", "#E6A16E"],
  ["008", "Pumpkin", "#C76A28"],
  ["009", "Terra Cotta", "#A6502B"],
  ["010", "Chestnut", "#7A4728"],
  ["011", "Walnut", "#4E2F20"],
  ["012", "Espresso", "#241812"],
  ["013", "Black", "#080706"],
  ["014", "Pearl Gray", "#D1D0CB"],
  ["015", "Silver", "#B9BBB5"],
  ["016", "Pewter", "#858781"],
  ["017", "Charcoal", "#454642"],
  ["018", "Blush", "#EABDB7"],
  ["019", "Shell Pink", "#D99392"],
  ["020", "Rose", "#C76379"],
  ["021", "Cranberry", "#A92849"],
  ["022", "Garnet", "#671B2D"],
  ["023", "Scarlet", "#C52831"],
  ["024", "Coral", "#DE735F"],
  ["025", "Peach", "#F0B18D"],
  ["026", "Lemon", "#F4D95C"],
  ["027", "Marigold", "#E6A93A"],
  ["028", "Olive", "#697242"],
  ["029", "Moss", "#52613D"],
  ["030", "Sage", "#9EA785"],
  ["031", "Mint", "#A8D4BA"],
  ["032", "Emerald", "#26744F"],
  ["033", "Pine", "#173E2F"],
  ["034", "Aqua", "#79BFB8"],
  ["035", "Teal", "#24777A"],
  ["036", "Deep Sea", "#164B57"],
  ["037", "Sky", "#A8CBDD"],
  ["038", "French Blue", "#6B92B7"],
  ["039", "Denim", "#3E628B"],
  ["040", "Navy", "#162747"],
  ["041", "Periwinkle", "#9EA6D5"],
  ["042", "Lavender", "#B593C8"],
  ["043", "Violet", "#725498"],
  ["044", "Plum", "#613450"],
  ["045", "Orchid", "#C28ABE"],
  ["046", "Taupe", "#8E7B6A"],
  ["047", "Mocha", "#6D5748"],
  ["048", "Cocoa", "#5A3A2D"],
  ["049", "Warm Brown", "#9A6235"],
  ["050", "Rust", "#8B381E"]
];

function prefixed(prefix, rows = BASE) {
  return rows.map(([number, name, hex]) => [`${prefix}-${number}`, name, hex]);
}

PALETTES.dmc_perle = {
  id: "dmc_perle",
  label: "DMC Pearl Cotton #5",
  note: "DMC Pearl Cotton palette scaffold with approximate screen hex values. Replace with an official color-card CSV for production-accurate matching.",
  colors: prefixed("PC")
};

PALETTES.appleton_wool = {
  id: "appleton_wool",
  label: "Appleton Tapestry Wool",
  note: "Appleton Tapestry Wool palette scaffold with approximate screen hex values. Replace with official Appletons shade data when available.",
  colors: prefixed("AP")
};

PALETTES.paternayan_wool = {
  id: "paternayan_wool",
  label: "Paternayan Persian Wool",
  note: "Paternayan-style Persian wool palette scaffold. Useful for legacy needlepoint planning; replace with a verified conversion chart or CSV for exact matching.",
  colors: prefixed("PY")
};

PALETTES.vineyard_silk = {
  id: "vineyard_silk",
  label: "Vineyard Silk Classic",
  note: "Vineyard Silk Classic palette scaffold with approximate screen hex values. Replace with official color-card CSV for shop-ready output.",
  colors: prefixed("VS")
};

PALETTES.planet_earth_silk = {
  id: "planet_earth_silk",
  label: "Planet Earth Silk",
  note: "Planet Earth Silk palette scaffold with approximate screen hex values. Replace with official color-card CSV for shop-ready output.",
  colors: prefixed("PE")
};

PALETTES.pepper_pot_silk = {
  id: "pepper_pot_silk",
  label: "Pepper Pot Silk",
  note: "Pepper Pot Silk palette scaffold with approximate screen hex values. Replace with official color-card CSV for shop-ready output.",
  colors: prefixed("PP")
};

PALETTES.silk_ivory = {
  id: "silk_ivory",
  label: "Silk & Ivory",
  note: "Silk & Ivory wool/silk-blend palette scaffold with approximate screen hex values. Replace with official color-card CSV for accurate matching.",
  colors: prefixed("SI")
};

PALETTES.rainbow_gallery = {
  id: "rainbow_gallery",
  label: "Rainbow Gallery Fibers",
  note: "Rainbow Gallery-style specialty fiber palette scaffold. Use for planning decorative fibers; replace with product-specific CSVs for exact matching.",
  colors: prefixed("RG")
};

PALETTES.kreinik_metallic = {
  id: "kreinik_metallic",
  label: "Kreinik Metallic Braid",
  note: "Kreinik-style metallic braid palette scaffold. Metallics are best used as accent layers; color appearance changes strongly with light and reflection.",
  colors: [
    ["KR-001", "Silver", "#C9CDD1"],
    ["KR-002", "Gold", "#D4AF37"],
    ["KR-003", "Antique Gold", "#B58A2B"],
    ["KR-004", "Copper", "#B66A3C"],
    ["KR-005", "Bronze", "#8A6A3A"],
    ["KR-006", "Black", "#171717"],
    ["KR-007", "White Pearl", "#F6F2E8"],
    ["KR-008", "Red", "#B71F32"],
    ["KR-009", "Blue", "#285C9C"],
    ["KR-010", "Emerald", "#1E7A50"],
    ["KR-011", "Violet", "#6F4BA0"],
    ["KR-012", "Opal", "#DDEDEA"]
  ]
};
