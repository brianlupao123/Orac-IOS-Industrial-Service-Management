import { TECHNICIAN_TRADES } from "./constants/trades.js";

// Master Trade & Skill Catalog with industry-standard base rates and job descriptions.
// Rates can be configured and updated by Admin or Finance without touching code.
const DEFAULT_TRADE_PROFILES = [
  {
    id: "fitter",
    name: "Fitter",
    category: "Artisan",
    description: "Mill alignment, slurry pumps overhaul, mechanical gearbox and conveyor maintenance.",
    hourly_rate: 2.50,
    ot_15_rate: 3.75,
    ot_20_rate: 5.00
  },
  {
    id: "fitter-assistant",
    name: "Fitter Assistant",
    category: "Assistant",
    description: "Mechanical tool handling, staging spare parts, pump and pipe cleanup.",
    hourly_rate: 1.06,
    ot_15_rate: 1.59,
    ot_20_rate: 2.12
  },
  {
    id: "boilermaker",
    name: "Boilermaker",
    category: "Artisan",
    description: "Heavy structural steel fabrication, chute lining, plate welding, and hopper repair.",
    hourly_rate: 2.40,
    ot_15_rate: 3.60,
    ot_20_rate: 4.80
  },
  {
    id: "boilermaker-assistant",
    name: "Boilermaker Assistant",
    category: "Assistant",
    description: "Grinding, oxy-acetylene torch staging, plate holding, and work area housekeeping.",
    hourly_rate: 1.06,
    ot_15_rate: 1.59,
    ot_20_rate: 2.12
  },
  {
    id: "coded-welder",
    name: "Welder",
    category: "Artisan",
    description: "High-pressure pipe welding, ASME IX certification, arc and TIG/MIG welding.",
    hourly_rate: 3.20,
    ot_15_rate: 4.80,
    ot_20_rate: 6.40
  },
  {
    id: "welder-assistant",
    name: "Welder Assistant",
    category: "Assistant",
    description: "Slag chipping, weld preparation, cable management, and safety fire-watch.",
    hourly_rate: 1.06,
    ot_15_rate: 1.59,
    ot_20_rate: 2.12
  },
  {
    id: "electrician",
    name: "Electrician",
    category: "Artisan",
    description: "Motor control centers (MCC), 33kV substations, transformer checks, and cable jointing.",
    hourly_rate: 2.60,
    ot_15_rate: 3.90,
    ot_20_rate: 5.20
  },
  {
    id: "instrument-tech",
    name: "Instrument Technician",
    category: "Artisan",
    description: "PLC calibration, flowmeters, level transmitters, density gauges, and loop testing.",
    hourly_rate: 2.80,
    ot_15_rate: 4.20,
    ot_20_rate: 5.60
  },
  {
    id: "instrument-assistant",
    name: "Instrument Assistant",
    category: "Assistant",
    description: "Instrument cabling support, signal conduit installation, and bench prep.",
    hourly_rate: 1.06,
    ot_15_rate: 1.59,
    ot_20_rate: 2.12
  },
  {
    id: "rigger",
    name: "Rigger",
    category: "Artisan",
    description: "Crane lifting plans, heavy machinery rigging, sling inspections, and winching.",
    hourly_rate: 2.40,
    ot_15_rate: 3.60,
    ot_20_rate: 4.80
  },
  {
    id: "rigger-assistant",
    name: "Rigger Assistant",
    category: "Assistant",
    description: "Tag-line handling, shackle staging, sling storage, and landing area clearing.",
    hourly_rate: 1.06,
    ot_15_rate: 1.59,
    ot_20_rate: 2.12
  },
  {
    id: "scaffolder-assistant",
    name: "Scaffolder Assistant",
    category: "Assistant",
    description: "Scaffold tube carrying, coupler staging, safety harness inspection, and tagging.",
    hourly_rate: 1.06,
    ot_15_rate: 1.59,
    ot_20_rate: 2.12
  },
  {
    id: "plumber",
    name: "Plumber",
    category: "Artisan",
    description: "Industrial process water piping, HDPE fusion, valve overhauls, and drainage.",
    hourly_rate: 2.20,
    ot_15_rate: 3.30,
    ot_20_rate: 4.40
  },
  {
    id: "plumber-assistant",
    name: "Plumber Assistant",
    category: "Assistant",
    description: "Pipe trenching, joint cleaning, primer/glue handling, and material transport.",
    hourly_rate: 1.06,
    ot_15_rate: 1.59,
    ot_20_rate: 2.12
  },
  {
    id: "general-hand",
    name: "General Hand",
    category: "Assistant",
    description: "Site housekeeping, cleaning smelter shut areas, loading/unloading delivery trucks.",
    hourly_rate: 1.06,
    ot_15_rate: 1.59,
    ot_20_rate: 2.12
  }
];

const STORAGE_KEY = "orac_trade_profiles_v1";

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getTradeProfiles() {
  const store = safeStorage();
  if (store) {
    const raw = store.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fall back to defaults
      }
    }
  }
  return DEFAULT_TRADE_PROFILES;
}

export function saveTradeProfile(updatedTrade) {
  const store = safeStorage();
  const current = getTradeProfiles();
  const index = current.findIndex((t) => t.name.toLowerCase() === updatedTrade.name.toLowerCase() || t.id === updatedTrade.id);
  let next = [];
  if (index >= 0) {
    next = current.map((t, i) => (i === index ? { ...t, ...updatedTrade } : t));
  } else {
    next = [...current, { ...updatedTrade, id: updatedTrade.id || updatedTrade.name.toLowerCase().replace(/\s+/g, "-") }];
  }
  if (store) {
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function resetTradeProfilesToDefault() {
  const store = safeStorage();
  if (store) store.removeItem(STORAGE_KEY);
  return DEFAULT_TRADE_PROFILES;
}

export function getRatesForTrade(tradeName) {
  if (!tradeName) return { hourly_rate: 1.06, ot_15_rate: 1.59, ot_20_rate: 2.12, category: "Assistant" };
  const profiles = getTradeProfiles();
  const found = profiles.find((t) => t.name.toLowerCase() === String(tradeName).trim().toLowerCase());
  if (found) {
    return {
      hourly_rate: Number(found.hourly_rate || 1.06),
      ot_15_rate: Number(found.ot_15_rate || (found.hourly_rate * 1.5)),
      ot_20_rate: Number(found.ot_20_rate || (found.hourly_rate * 2.0)),
      category: found.category || (found.name.toLowerCase().includes("assistant") ? "Assistant" : "Artisan")
    };
  }
  const isArtisan = !tradeName.toLowerCase().includes("assistant") && !tradeName.toLowerCase().includes("hand");
  const base = isArtisan ? 2.50 : 1.06;
  return {
    hourly_rate: base,
    ot_15_rate: base * 1.5,
    ot_20_rate: base * 2.0,
    category: isArtisan ? "Artisan" : "Assistant"
  };
}

export function computeTradeHeadcounts(users = []) {
  const counts = {};
  for (const u of users) {
    if (u.role === "Technician" || u.trade) {
      const tradeKey = u.trade || "Unclassified";
      counts[tradeKey] = (counts[tradeKey] || 0) + 1;
    }
  }
  return counts;
}
