// =============================================================================
// Núcleo — Sistema Operativo Personal
// Categorización inteligente de transacciones bancarias y Apple Wallet
// =============================================================================

export interface MerchantCategoryRule {
  category: string;
  keywords: string[];
}

const CATEGORY_RULES: MerchantCategoryRule[] = [
  {
    category: "Alimentación",
    keywords: [
      "mercadona",
      "carrefour",
      "lidl",
      "dia ",
      "dia%",
      "supermercado",
      "alcampo",
      "eroski",
      "consum",
      "aldi",
      "bonpreu",
      "hipercor",
      "supercor",
      "spar",
      "fruteria",
      "frutería",
      "panaderia",
      "panadería",
      "carniceria",
      "carnicería",
      "pescaderia",
      "pescadería",
      "pasteleria",
      "pastelería",
      "glovo",
      "uber eats",
      "just eat",
      "too good to go",
    ],
  },
  {
    category: "Transporte",
    keywords: [
      "renfe",
      "metro",
      "cercanias",
      "cercanías",
      "emt",
      "tmb",
      "alsa",
      "uber",
      "cabify",
      "bolt",
      "freenow",
      "repsol",
      "cepsa",
      "bp ",
      "shell",
      "galp",
      "gasolinera",
      "estacion de servicio",
      "parking",
      "aparcamiento",
      "peaje",
      "autopista",
      "bici",
      "bicimad",
      "lime",
      "tier",
      "dott",
      "vueling",
      "ryanair",
      "iberia",
      "air europa",
      "easyjet",
    ],
  },
  {
    category: "Suscripciones",
    keywords: [
      "spotify",
      "netflix",
      "apple.com/bill",
      "itunes",
      "disney",
      "hbo",
      "max.com",
      "amazon prime",
      "prime video",
      "youtube premium",
      "dazn",
      "chatgpt",
      "openai",
      "github",
      "google storage",
      "google one",
      "playstation",
      "xbox",
      "nintendo",
      "patreon",
      "audible",
    ],
  },
  {
    category: "Ocio",
    keywords: [
      "restaurante",
      "bar ",
      "cafeteria",
      "cafetería",
      "cerveceria",
      "cervecería",
      "mcdonald",
      "burger king",
      "kfc",
      "starbucks",
      "vips",
      "foster",
      "domino",
      "telepizza",
      "pizzeria",
      "pizzería",
      "taco bell",
      "gino",
      "100 montaditos",
      "cine",
      "yelmo",
      "cinesa",
      "teatro",
      "concierto",
      "ticketmaster",
      "dice.fm",
      "pub ",
      "discoteca",
      "escape room",
      "bowling",
      "steam",
    ],
  },
  {
    category: "Ropa",
    keywords: [
      "zara",
      "pull&bear",
      "pull and bear",
      "bershka",
      "stradivarius",
      "mango",
      "h&m",
      "primark",
      "massimo dutti",
      "oysho",
      "springfield",
      "cortefiel",
      "shein",
      "zalando",
      "asos",
      "nike",
      "adidas",
      "decathlon",
      "foot locker",
      "jd sports",
    ],
  },
  {
    category: "Salud",
    keywords: [
      "farmacia",
      "optica",
      "óptica",
      "dentista",
      "dental",
      "clinica",
      "clínica",
      "hospital",
      "sanitas",
      "adeslas",
      "asisa",
      "mapfre salud",
      "fisioterapia",
      "podologo",
      "podólogo",
      "psicologo",
      "psicólogo",
    ],
  },
  {
    category: "Vivienda",
    keywords: [
      "ikea",
      "leroy merlin",
      "bauhaus",
      "bricomart",
      "obramat",
      "zara home",
      "endesa",
      "ibderdrola",
      "iberdrola",
      "naturgy",
      "vodafone",
      "movistar",
      "orange",
      "masorange",
      "yoigo",
      "digi",
      "comunidad de propietarios",
      "alquiler",
    ],
  },
  {
    category: "Estudios",
    keywords: [
      "universidad",
      "colegio",
      "instituto",
      "academia",
      "matricula",
      "matrícula",
      "uned",
      "udemy",
      "coursera",
      "platzi",
      "libreria",
      "librería",
      "papeleria",
      "papelería",
      "reprografia",
      "reprografía",
      "copisteria",
      "copistería",
    ],
  },
  {
    category: "Otros",
    keywords: [
      "amazon",
      "el corte ingles",
      "el corte inglés",
      "aliexpress",
      "mediamarkt",
      "fnac",
      "pccomponentes",
      "correos",
      "estanco",
      "bazar",
    ],
  },
];

/**
 * Deduce automáticamente la categoría de un gasto a partir del nombre del comercio,
 * tienda o concepto devuelto por Apple Pay, Wallet o extracto bancario.
 */
export function inferExpenseCategory(merchantOrDesc?: string | null): string {
  if (!merchantOrDesc || typeof merchantOrDesc !== "string") {
    return "Otros";
  }

  const normalized = merchantOrDesc
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      const cleanKw = kw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normalized.includes(cleanKw)) {
        return rule.category;
      }
    }
  }

  return "Otros";
}
