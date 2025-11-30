
import { GoogleGenAI, Type } from "@google/genai";
import { PokemonAnalysis, TeamRecommendation, MetaPokemonData, TeamSynergyAnalysis, MetaTeamData, Language, Generation, Regulation, PokemonType } from '../types';
import { getEffectiveness } from '../constants';

// --- GLOBAL OFFLINE CIRCUIT BREAKER ---
let isGlobalOffline = false;

// Override for the specific user request if needed, but primarily relying on process.env
// In a real app, this fallback would be handled via env vars, but for this demo environment:
const USER_PROVIDED_KEY = "AIzaSyBqJv79RZvmDrCXdWjVOtwg1ctRyjRz-JY";

const getAiClient = () => {
  if (isGlobalOffline) return null;
  // Runtime safety check for process.env, with fallback to the user provided key for this session
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : USER_PROVIDED_KEY;
  
  if (!apiKey) {
    console.warn("API Key not found. Using Offline Mode.");
    isGlobalOffline = true;
    return null; 
  }
  return new GoogleGenAI({ apiKey });
};

// --- CACHING SYSTEM ---
const CACHE_PREFIX = 'za_meta_v3_'; // Bump version for new rules
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 Hours

const getLocalStorage = <T>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const item = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;
    const { data, ts } = JSON.parse(item);
    if (Date.now() - ts > CACHE_TTL) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data as T;
  } catch (e) { return null; }
};

const setLocalStorage = <T>(key: string, data: T) => {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({ data, ts: Date.now() });
    window.localStorage.setItem(CACHE_PREFIX + key, payload);
  } catch (e) { console.warn('Storage full', e); }
};

const teamCache: Record<string, TeamRecommendation> = {};
const metaCache: Record<string, MetaPokemonData[]> = {};
const metaTeamsCache: Record<string, MetaTeamData[]> = {}; 
const analysisCache: Record<string, PokemonAnalysis> = {};
const synergyCache: Record<string, TeamSynergyAnalysis> = {};

// --- PRE-LOADED DATA ---

const FALLBACK_META_DATA: MetaPokemonData[] = [
    { 
        rank: 1, id: 718, nameEn: "Zygarde (Complete)", nameZh: "基格尔德(完全)", types: ["Dragon", "Ground"], usageRate: 92.5, 
        keyMovesEn: ["Thousand Arrows", "Dragon Dance", "Core Enforcer", "Rest"], keyMovesZh: ["千箭齐发", "龙之舞", "核心惩罚者", "睡觉"], 
        stats: { hp: 216, attack: 100, defense: 121, spAtk: 91, spDef: 95, speed: 85 }, isAOE: true, hasCrowdControl: true, baseStatsTotal: 708, 
        analysisEn: "The undisputed ruler of the Z-A meta. With a colossal 216 HP base stat, it functions as an unkillable Raid Boss. Its signature move 'Thousand Arrows' hits Flying types and provides unmatched AOE ground control.", 
        analysisZh: "Z-A 环境当之无愧的统治者。凭借高达 216 的 HP 种族值，它宛如一个无法被击杀的团本 BOSS。专属招式“千箭齐发”能击落飞行系，提供无死角的地面系广域压制力。", 
        winRate: 0 
    },
    { 
        rank: 2, id: 6, nameEn: "Mega Charizard Y", nameZh: "超级喷火龙Y", types: ["Fire", "Flying"], usageRate: 85.2, 
        keyMovesEn: ["Heat Wave", "Solar Beam", "Scorching Sands", "Roost"], keyMovesZh: ["热风", "日光束", "热沙大地", "羽栖"], 
        stats: { hp: 78, attack: 104, defense: 78, spAtk: 159, spDef: 115, speed: 100 }, isAOE: true, hasCrowdControl: false, baseStatsTotal: 634, 
        analysisEn: "Possesses a staggering 159 Sp.Atk. Even without Drought ability, its raw damage output with 'Heat Wave' acts as a screen-clearing tactical nuke. Excellent special defense allows it to trade hits effectively.", 
        analysisZh: "拥有惊人的 159 特攻种族值。即使在没有日照特性的情况下，其“热风”的原始伤害也足以作为清屏核弹使用。优秀的特防使其在对攻中占据优势。", 
        winRate: 0 
    },
    { 
        rank: 3, id: 716, nameEn: "Xerneas", nameZh: "哲尔尼亚斯", types: ["Fairy"], usageRate: 78.4, 
        keyMovesEn: ["Geomancy", "Moonblast", "Dazzling Gleam", "Thunder"], keyMovesZh: ["大地掌控", "月亮之力", "魔法闪耀", "打雷"], 
        stats: { hp: 126, attack: 131, defense: 95, spAtk: 131, spDef: 98, speed: 99 }, isAOE: true, hasCrowdControl: true, baseStatsTotal: 680, 
        analysisEn: "Geomancy remains the most broken setup move, boosting Speed, Sp.Atk, and Sp.Def simultaneously. Once set up, 'Dazzling Gleam' provides consistent, high-damage AOE that few can withstand.", 
        analysisZh: "“大地掌控”依然是最高效的强化技能，能同时大幅提升速度、特攻和特防。强化完成后，“魔法闪耀”能提供持续且高额的 AOE 爆发，鲜有对手能挡。", 
        winRate: 0 
    },
    { 
        rank: 4, id: 115, nameEn: "Mega Kangaskhan", nameZh: "超级袋兽", types: ["Normal"], usageRate: 66.1, 
        keyMovesEn: ["Fake Out", "Double-Edge", "Sucker Punch", "Power-Up Punch"], keyMovesZh: ["击掌奇袭", "舍身冲撞", "突袭", "增强拳"], 
        stats: { hp: 105, attack: 125, defense: 100, spAtk: 60, spDef: 100, speed: 100 }, isAOE: false, hasCrowdControl: true, baseStatsTotal: 590, 
        analysisEn: "Even without Parental Bond, its stats are incredibly well-rounded. 'Fake Out' is a critical tool in real-time combat for flinching enemies, creating openings for teammates to land AOE bursts.", 
        analysisZh: "即便没有亲子爱特性，其种族值分配依然极其完美。“击掌奇袭”在即时战斗中是至关重要的控制手段，能打断敌人动作为队友创造 AOE 爆发的窗口。", 
        winRate: 0 
    },
    { 
        rank: 5, id: 448, nameEn: "Mega Lucario", nameZh: "超级路卡利欧", types: ["Fighting", "Steel"], usageRate: 60.5, 
        keyMovesEn: ["Close Combat", "Meteor Mash", "Bullet Punch", "Vacuum Wave"], keyMovesZh: ["近身战", "彗星拳", "子弹拳", "真空波"], 
        stats: { hp: 70, attack: 145, defense: 88, spAtk: 140, spDef: 70, speed: 112 }, isAOE: false, hasCrowdControl: false, baseStatsTotal: 625, 
        analysisEn: "A mixed attacking glass cannon. Its high speed translates to rapid Skill Cooldowns (CDR), allowing it to spam 'Close Combat' and 'Meteor Mash' for arguably the highest DPS in the game.", 
        analysisZh: "典型的双刀玻璃大炮。极高的速度属性转化为极短的技能冷却（CDR），使其能高频释放“近身战”和“彗星拳”，拥有全游戏顶尖的 DPS。", 
        winRate: 0 
    },
    { 
        rank: 6, id: 681, nameEn: "Aegislash", nameZh: "坚盾剑怪", types: ["Steel", "Ghost"], usageRate: 58.0, 
        keyMovesEn: ["King's Shield", "Shadow Ball", "Close Combat", "Shadow Sneak"], keyMovesZh: ["王者盾牌", "暗影球", "近身战", "影子偷袭"], 
        stats: { hp: 60, attack: 50, defense: 140, spAtk: 50, spDef: 140, speed: 60 }, isAOE: false, hasCrowdControl: true, baseStatsTotal: 520, 
        analysisEn: "Relies on form switching. Shield Forme offers 140 defenses to tank AOE, while Blade Forme deals massive damage. 'King's Shield' is the best defensive cooldown in the game.", 
        analysisZh: "依赖形态切换战斗。盾牌形态提供 140 的双防来承受 AOE，而刀剑形态则打出巨额爆发。“王者盾牌”是目前游戏中最强的防御技能。", 
        winRate: 0 
    }
];

// REVISED TEAMS: Adhering to "Max 1 Restricted" and "Kalos Dex Only"
const FALLBACK_TEAMS: MetaTeamData[] = [
    {
        rank: 1,
        nameEn: "Zygarde Balance Core",
        nameZh: "基格尔德完全体核心",
        members: ["Zygarde (Complete)", "Mega Scizor", "Sylveon"],
        membersZh: ["基格尔德(完全)", "超级巨钳螳螂", "仙子伊布"],
        winRate: 71.5,
        usageRate: 24.8,
        synergyScore: 96,
        coreStrategyEn: "Raid Boss Sustain.",
        coreStrategyZh: "BOSS级耐久与联防。",
        analysisEn: "Zygarde (Restricted) acts as the anchor. Mega Scizor covers Ice/Fairy weaknesses perfectly. Sylveon provides Cleric support and spread damage with Hyper Voice.",
        analysisZh: "基格尔德（一级神）作为核心坦克。超级巨钳螳螂完美联防冰/妖精系弱点。仙子伊布提供队医支持并用巨声补充AOE特攻。"
    },
    {
        rank: 2,
        nameEn: "Geomancy Offense",
        nameZh: "大地掌控进攻轴",
        members: ["Xerneas", "Mega Kangaskhan", "Talonflame"],
        membersZh: ["哲尔尼亚斯", "超级袋兽", "烈箭鹰"],
        winRate: 67.2,
        usageRate: 20.1,
        synergyScore: 93,
        coreStrategyEn: "Setup Sweep & Priority Support.",
        coreStrategyZh: "强化推队与先制掩护。",
        analysisEn: "Xerneas (Restricted) is the win condition. Mega Kangaskhan provides Fake Out to buy turn for Geomancy. Talonflame sets Tailwind and threatens Steel types with Flare Blitz.",
        analysisZh: "哲尔尼亚斯（一级神）是制胜点。超级袋兽提供击掌奇袭为大地掌控争取回合。烈箭鹰开启顺风并用闪焰冲锋压制钢系。"
    },
    {
        rank: 3,
        nameEn: "Yveltal Dark Spam",
        nameZh: "Y神暗黑爆破组",
        members: ["Yveltal", "Mega Mawile", "Aegislash"],
        membersZh: ["伊菲尔塔尔", "超级大嘴娃", "坚盾剑怪"],
        winRate: 63.8,
        usageRate: 16.5,
        synergyScore: 90,
        coreStrategyEn: "Dark Aura Damage Amp.",
        coreStrategyZh: "暗黑气场增伤压制。",
        analysisEn: "Yveltal (Restricted) boosts all Dark moves. Mega Mawile benefits from Sucker Punch boost. Aegislash provides Shadow Ball spam and pivots.",
        analysisZh: "伊菲尔塔尔（一级神）提升全场恶系伤害。超级大嘴娃受益于突袭增伤。坚盾剑怪提供暗影球爆发与联防轮转。"
    },
    {
        rank: 4,
        nameEn: "Sun & Sand (No Restricted)",
        nameZh: "晴沙双天气 (无神兽)",
        members: ["Mega Charizard Y", "Tyranitar", "Heliolisk"],
        membersZh: ["超级喷火龙Y", "班基拉斯", "光电伞蜥"],
        winRate: 59.4,
        usageRate: 13.2,
        synergyScore: 86,
        coreStrategyEn: "Weather Wars & AOE.",
        coreStrategyZh: "天气控制与广域AOE。",
        analysisEn: "Charizard Y sets Sun for heat damage. Tyranitar sets Sand to boost SpDef and check opposing Flyers. Heliolisk (Solar Power) acts as a fast sweeper under Sun.",
        analysisZh: "Y喷开启晴天提升火系伤害。班基拉斯开启沙暴提升特防并限制飞行系。光电伞蜥利用太阳之力特性在晴天下高速输出。"
    },
    {
        rank: 5,
        nameEn: "Kalos Goodstuffs",
        nameZh: "卡洛斯好胜队",
        members: ["Mega Lucario", "Dragonite", "Rotom-Wash"],
        membersZh: ["超级路卡利欧", "快龙", "清洗洛托姆"],
        winRate: 56.7,
        usageRate: 11.5,
        synergyScore: 84,
        coreStrategyEn: "High Speed & Pivot.",
        coreStrategyZh: "高速压制与中转。",
        analysisEn: "Mega Lucario is the breaker. Dragonite (Multiscale) functions as a bulky sweeper. Rotom-Wash covers Ground types attacking Lucario and Ice types attacking Dragonite.",
        analysisZh: "超级路卡利欧作为破盾手。快龙（多重鳞片）担任耐久强化手。清洗洛托姆完美覆盖路卡利欧惧怕的地面系和快龙惧怕的冰系。"
    }
];

const PRELOADED_ANALYSIS_MAP: Record<string, PokemonAnalysis> = {};
const addPreloaded = (data: PokemonAnalysis) => {
    PRELOADED_ANALYSIS_MAP[data.nameEn.toLowerCase()] = data;
    PRELOADED_ANALYSIS_MAP[data.nameZh] = data;
    if (data.nameEn.includes("Mega ")) PRELOADED_ANALYSIS_MAP[data.nameEn.replace("Mega ", "").toLowerCase()] = data;
    if (data.nameEn.includes(" (Complete)")) PRELOADED_ANALYSIS_MAP["zygarde"] = data;
};

// ... [Existing Preloaded Data] ...
addPreloaded({
    nameEn: "Zygarde (Complete)", nameZh: "基格尔德(完全)", types: ["Dragon", "Ground"], roleEn: "Raid Boss Tank", roleZh: "团本级坦克", tier: "S+",
    stats: { hp: 216, attack: 100, defense: 121, spAtk: 91, spDef: 95, speed: 85 },
    comparisonStats: { hp: 108, attack: 100, defense: 121, spAtk: 81, spDef: 95, speed: 95 }, comparisonLabel: "50% Form",
    strengthsEn: ["Pikachu", "Heatran", "Aegislash"], strengthsZh: ["皮卡丘", "席多蓝恩", "坚盾剑怪"],
    weaknessesEn: ["Ice Beam", "Moonblast", "Fairy Types"], weaknessesZh: ["冰冻光束", "月亮之力", "妖精系"],
    coverageEn: ["Extreme Speed", "Stone Edge"], coverageZh: ["神速", "尖石攻击"],
    partnersEn: ["Xerneas", "Incineroar"], partnersZh: ["哲尔尼亚斯", "炽焰咆哮虎"],
    matchupNetwork: [
        { opponentEn: "Xerneas", opponentZh: "哲尔尼亚斯", opponentTypes: ["Fairy"], result: "lose", descriptionEn: "Weak to Fairy moves like Moonblast.", descriptionZh: "弱妖精系招式（如月亮之力）。" },
        { opponentEn: "Mega Charizard Y", opponentZh: "超级喷火龙Y", opponentTypes: ["Fire", "Flying"], result: "check", descriptionEn: "Thousand Arrows grounds it.", descriptionZh: "千箭齐发将其击落。" }
    ],
    summaryEn: "With 216 base HP, it is the definition of bulk. In Z-A's action combat, its 'Thousand Arrows' hits Flying types and provides a reliable, unmissable AOE option. It acts as the anchor for any team.",
    summaryZh: "拥有 216 的基础 HP，它定义了何为“耐久”。在 Z-A 的即时战斗中，其“千箭齐发”不仅能击中飞行系，还提供了稳定、必中的广域伤害。它是任何队伍的中流砥柱。"
});

// Helper for generic fallback
const getPreloadedAnalysis = (name: string): PokemonAnalysis | null => {
    const key = name.toLowerCase().trim();
    return PRELOADED_ANALYSIS_MAP[key] || 
           PRELOADED_ANALYSIS_MAP[Object.keys(PRELOADED_ANALYSIS_MAP).find(k => key.includes(k) || k.includes(key)) || ""] || 
           null;
};

// --- MAIN FUNCTIONS ---

const getGenContext = (gen: Generation, season: Regulation = 'season1'): string => {
  switch (gen) {
    case 'legends-za':
      let seasonRules = "";
      if (season === 'season1') {
        seasonRules = "WHITELIST: Kalos Dex ONLY. BANNED: Xerneas, Yveltal, Zygarde, Mewtwo.";
      } else if (season === 'season2') {
        seasonRules = "WHITELIST: Kalos Dex + Xerneas & Yveltal Unlocked. BANNED: Zygarde (Complete), Mewtwo.";
      } else if (season === 'season3') {
        seasonRules = "WHITELIST: Kalos Dex + All Kalos Legends. RULE: Max 1 Restricted Legendary (X/Y/Z/Mewtwo) per team.";
      } else {
        seasonRules = "Standard Kalos Dex rules. Max 1 Restricted Legendary.";
      }
      return `Generation Context: Pokémon Legends Z-A (PvP Environment).
      CRITICAL MECHANICS:
      1. Action RPG Combat. SPEED STAT determines Skill Cooldown Reduction (CDR).
      2. Moves have AREA OF EFFECT (AOE).
      3. NO ABILITIES exist (unless specified for Mega mechanics).
      4. PVP RULES: Max 1 Restricted Legendary (Xerneas, Yveltal, Zygarde, Mewtwo) per team.
      ${seasonRules}`;
    case 'gen9': return "Generation Context: Gen 9 (Scarlet/Violet). Regulation H.";
    case 'gen8': return "Generation Context: Gen 8 (Sword/Shield). Dynamax allowed.";
    case 'gen6': return "Generation Context: Gen 6 (X/Y). Mega Evolution allowed.";
    default: return "Gen 9 Context";
  }
};

const calculateMetaMatrix = (pokemonList: MetaPokemonData[], generation: Generation): MetaPokemonData[] => {
  if (!pokemonList || pokemonList.length === 0) return [];
  const WEIGHT_STATS = 0.35, WEIGHT_MATCHUP = 0.45, WEIGHT_MECHANICS = 0.20;

  const statScores = pokemonList.map(p => {
    const hpScore = p.stats.hp * 2.0;
    const offenseScore = Math.max(p.stats.attack, p.stats.spAtk) * 1.3;
    const defScore = (p.stats.defense + p.stats.spDef) * 1.0;
    const speedWeight = generation === 'legends-za' ? 0 : 0.4;
    return hpScore + offenseScore + defScore + (p.stats.speed * speedWeight);
  });
  
  const maxStat = Math.max(...statScores) || 1;
  const minStat = Math.min(...statScores) || 0;

  const matchupScores = pokemonList.map((subject, i) => {
    let adv = 0;
    pokemonList.forEach((opponent, j) => {
      if (i === j) return;
      let off = 0;
      subject.types.forEach(atk => {
        let m = 1; opponent.types.forEach(def => m *= getEffectiveness(atk as PokemonType, def as PokemonType));
        if (m > off) off = m;
      });
      let def = 0;
      opponent.types.forEach(atk => {
        let m = 1; subject.types.forEach(def => m *= getEffectiveness(atk as PokemonType, def as PokemonType));
        if (m > def) def = m;
      });
      adv += (off - def);
    });
    return adv;
  });

  const maxMatch = Math.max(...matchupScores) || 1;
  const minMatch = Math.min(...matchupScores) || 0;

  return pokemonList.map((p, i) => {
    const nStat = (statScores[i] - minStat) / (maxStat - minStat || 1);
    const nMatch = (matchupScores[i] - minMatch) / (maxMatch - minMatch || 1);
    let mech = 0.5;
    if (p.isAOE) mech += 0.3;
    if (p.hasCrowdControl) mech += 0.2;
    const raw = (nStat * WEIGHT_STATS) + (nMatch * WEIGHT_MATCHUP) + (mech * WEIGHT_MECHANICS);
    return { ...p, winRate: parseFloat((45 + (raw * 33)).toFixed(1)) };
  });
};

const OFFICIAL_ZH_PROMPT = `
CRITICAL TRANSLATION RULES:
1. Use STRICT Official Nintendo Simplified Chinese translations (官方简体中文).
2. For Move Names, Ability Names, and Item Names, cross-reference with 'xzonn.top' or '52poke' standards.
3. FIX COMMON ERRORS:
   - 'Shadow Ball' -> '暗影球'
   - 'Moonblast' -> '月亮之力'
   - 'Flutter Mane' -> '振翼发'
   - 'Iron Bundle' -> '铁包袱'
   - 'Mega Kangaskhan' -> '超级袋兽'
   - 'Close Combat' -> '近身战'
   - 'Trick Room' -> '戏法空间'
   - 'Earthquake' -> '地震'
   - 'Zygarde (Complete Forme)' -> '基格尔德 (完全形态)'
4. Do NOT use literal translations if an official term exists.
`;

export const getMetaAnalysis = async (generation: Generation, season: Regulation): Promise<MetaPokemonData[]> => {
  const cacheKey = `meta-${generation}-${season}`;
  if (metaCache[cacheKey]) return metaCache[cacheKey];
  const localData = getLocalStorage<MetaPokemonData[]>(cacheKey);
  if (localData) { metaCache[cacheKey] = localData; return localData; }

  // Fallback / Offline / Preload Mode
  if (isGlobalOffline || (generation === 'legends-za' && season === 'season3')) {
    return calculateMetaMatrix(FALLBACK_META_DATA, generation);
  }

  const client = getAiClient();
  if (!client) return calculateMetaMatrix(FALLBACK_META_DATA, generation);

  const context = getGenContext(generation, season);
  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}
    Analyze the current competitive meta. Return a JSON list of the Top 12 most viable Pokémon.
    
    IMPORTANT: Provide insightful tactical commentary (25-40 words) for 'analysisEn' and 'analysisZh'. 
    Explain WHY they are strong in an Action RPG setting (e.g., CDR, AOE, Bulk).
    DO NOT MENTION ABILITIES.
    
    List 4 key moves.
    Output strict JSON format (Array of objects).
  `;

  try {
    const response = await generateContentWithRetry(client, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const parsed: MetaPokemonData[] = JSON.parse(response.text || "[]");
    const calculatedData = calculateMetaMatrix(parsed, generation);
    metaCache[cacheKey] = calculatedData;
    setLocalStorage(cacheKey, calculatedData);
    return calculatedData;
  } catch (error) {
    return calculateMetaMatrix(FALLBACK_META_DATA, generation);
  }
};

export const getMetaTeams = async (generation: Generation, season: Regulation): Promise<MetaTeamData[]> => {
  const cacheKey = `meta-teams-${generation}-${season}`;
  if (metaTeamsCache[cacheKey]) return metaTeamsCache[cacheKey];
  const localData = getLocalStorage<MetaTeamData[]>(cacheKey);
  if (localData) { metaTeamsCache[cacheKey] = localData; return localData; }

  // Fallback / Offline
  if (isGlobalOffline || (generation === 'legends-za' && season === 'season3')) {
    return FALLBACK_TEAMS;
  }

  const client = getAiClient();
  if (!client) return FALLBACK_TEAMS;

  const context = getGenContext(generation, season);
  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}
    Analyze the current competitive meta and identify the Top 6 most powerful 3-Pokémon Core Squads (Teams).
    
    CRITICAL RULES FOR Z-A PVP:
    1. WHITELIST: KALOS REGIONAL POKEDEX ONLY (plus new Z-A forms/Megas).
    2. RESTRICTED LEGENDARIES: Teams may contain MAXIMUM ONE (1) Restricted Legendary from the following list: {Xerneas, Yveltal, Zygarde, Mewtwo}.
    3. PROHIBITED: Do not include Alolan/Galar/Paldea/Hisui specific Pokemon unless they are logically present in Lumiose City (Kalos).
    4. TEAM SIZE: Exactly 3 Pokémon per team.

    FOCUS ON SYNERGY:
    - Joint Defense (Covering weaknesses)
    - Combo Potential (AOE stacking, Crowd Control + Nuke)
    
    Metrics:
    - 'winRate' and 'usageRate' should be realistic estimates (0-100).
    
    Output strict JSON format (Array of objects matching MetaTeamData interface).
    Ensure 'members' is an array of English names and 'membersZh' is an array of Chinese names.
  `;

  try {
    const response = await generateContentWithRetry(client, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const parsed: MetaTeamData[] = JSON.parse(response.text || "[]");
    metaTeamsCache[cacheKey] = parsed;
    setLocalStorage(cacheKey, parsed);
    return parsed;
  } catch (error) {
    return FALLBACK_TEAMS;
  }
};

export const analyzePokemon = async (pokemonName: string, generation: Generation, season: Regulation): Promise<PokemonAnalysis | null> => {
  const normalizedName = pokemonName.trim().toLowerCase();
  const cacheKey = `analysis-${generation}-${season}-${normalizedName}`;

  if (analysisCache[cacheKey]) return analysisCache[cacheKey];
  const localData = getLocalStorage<PokemonAnalysis>(cacheKey);
  if (localData) { analysisCache[cacheKey] = localData; return localData; }

  const preloaded = getPreloadedAnalysis(normalizedName);
  if (preloaded) {
      analysisCache[cacheKey] = preloaded;
      return preloaded;
  }

  if (isGlobalOffline) return generateMockAnalysis(pokemonName);

  const client = getAiClient();
  if (!client) return generateMockAnalysis(pokemonName);

  const context = getGenContext(generation, season);
  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}
    Analyze the Pokémon "${pokemonName}" for competitive viability.
    
    CRITICAL INSTRUCTIONS:
    1. Coverage Types MUST list 2-4 distinct non-STAB move types.
    2. Summary MUST be detailed and strategic (50-80 words). 
    3. DO NOT MENTION ABILITIES unless crucial for Mega Evolution. Focus on Stats, Typing, AOE, and Speed(CDR).
    
    Output strict JSON.
  `;

  try {
    const response = await generateContentWithRetry(client, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const result = JSON.parse(response.text);
    analysisCache[cacheKey] = result;
    setLocalStorage(cacheKey, result);
    return result;
  } catch (error) {
    return generateMockAnalysis(pokemonName);
  }
};

export const generateTeam = async (promptText: string, lang: Language, generation: Generation, season: Regulation): Promise<TeamRecommendation | null> => {
  const cacheKey = `team-${generation}-${season}-${promptText.trim()}-${lang}`;
  if (teamCache[cacheKey]) return teamCache[cacheKey];
  const localData = getLocalStorage<TeamRecommendation>(cacheKey);
  if (localData) { teamCache[cacheKey] = localData; return localData; }

  if (isGlobalOffline) return generateMockTeam(promptText, generation);
  const client = getAiClient();
  if (!client) return generateMockTeam(promptText, generation);

  const context = getGenContext(generation, season);
  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}
    Build a competitive team based on: "${promptText}". Language: ${lang}.
    
    RULES:
    - If Generation is Legends Z-A: Max 1 Restricted Legendary allowed. Kalos Dex Only.
    
    Output strict JSON.
  `;

  try {
    const response = await generateContentWithRetry(client, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const result = JSON.parse(response.text);
    teamCache[cacheKey] = result;
    setLocalStorage(cacheKey, result);
    return result;
  } catch (error) {
    return generateMockTeam(promptText, generation);
  }
};

export const analyzeTeamSynergy = async (members: string[], generation: Generation, season: Regulation): Promise<TeamSynergyAnalysis | null> => {
    // Keep existing function for backward compatibility or potential future feature re-enablement
    const membersKey = members.map(m => m.trim().toLowerCase()).sort().join('-');
    const cacheKey = `synergy-${generation}-${season}-${membersKey}`;
    
    if (synergyCache[cacheKey]) return synergyCache[cacheKey];
    const localData = getLocalStorage<TeamSynergyAnalysis>(cacheKey);
    if (localData) { synergyCache[cacheKey] = localData; return localData; }

    if (isGlobalOffline) return generateMockSynergy(members);
    const client = getAiClient();
    if (!client) return generateMockSynergy(members);

    const context = getGenContext(generation, season);
    const prompt = `
      ${context}
      ${OFFICIAL_ZH_PROMPT}
      Analyze the synergy of this 3-Pokémon squad: ${members.join(', ')}.
      Output strict JSON.
    `;

    try {
        const response = await generateContentWithRetry(client, {
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        const result = JSON.parse(response.text);
        synergyCache[cacheKey] = result;
        setLocalStorage(cacheKey, result);
        return result;
    } catch (error) {
        return generateMockSynergy(members);
    }
};

const generateMockAnalysis = (name: string): PokemonAnalysis => ({
    nameEn: name, nameZh: name, types: ["Normal"], roleEn: "Offline", roleZh: "离线", tier: "?",
    stats: { hp: 80, attack: 80, defense: 80, spAtk: 80, spDef: 80, speed: 80 },
    comparisonStats: { hp: 70, attack: 70, defense: 70, spAtk: 70, spDef: 70, speed: 70 },
    strengthsEn: ["Unknown"], strengthsZh: ["未知"], weaknessesEn: ["Fighting"], weaknessesZh: ["格斗"],
    coverageEn: ["Normal"], coverageZh: ["一般"], partnersEn: ["None"], partnersZh: ["无"], matchupNetwork: [],
    summaryEn: "Offline Mode. Analysis unavailable.", summaryZh: "离线模式。无法获取分析。"
});

const generateMockTeam = (prompt: string, generation?: Generation): TeamRecommendation => {
    const isZA = generation === 'legends-za';
    const noAbility = "N/A"; 
    return {
        archetype: isZA ? "Z-A Kalos Core (Offline)" : "Balanced Core (Offline)", 
        explanation: "Offline mode active. Using standard Kalos PvP template.",
        members: [
            { name: "Mega Charizard Y", item: isZA ? "Charizardite Y" : "Heavy-Duty Boots", ability: isZA ? noAbility : "Drought", nature: "Timid", moves: ["Heat Wave", "Solar Beam", "Roost", "Scorching Sands"], role: "Special Attacker" },
            { name: "Zygarde (Complete)", item: "Leftovers", ability: isZA ? noAbility : "Power Construct", nature: "Adamant", moves: ["Thousand Arrows", "Dragon Dance", "Rest", "Sleep Talk"], role: "Restricted Tank" },
            { name: "Aegislash", item: "Weakness Policy", ability: isZA ? noAbility : "Stance Change", nature: "Quiet", moves: ["King's Shield", "Shadow Ball", "Close Combat", "Shadow Sneak"], role: "Pivot" },
            { name: "Sylveon", item: "Choice Specs", ability: isZA ? noAbility : "Pixilate", nature: "Modest", moves: ["Hyper Voice", "Psyshock", "Shadow Ball", "Quick Attack"], role: "Special Attacker" },
            { name: "Garchomp", item: "Life Orb", ability: isZA ? noAbility : "Rough Skin", nature: "Jolly", moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"], role: "Physical Attacker" },
            { name: "Rotom-Wash", item: "Sitrus Berry", ability: isZA ? noAbility : "Levitate", nature: "Calm", moves: ["Hydro Pump", "Volt Switch", "Will-O-Wisp", "Protect"], role: "Support" },
        ]
    };
};

const generateMockSynergy = (members: string[]): TeamSynergyAnalysis => ({
    teamName: "Offline Squad",
    synergyScore: 75,
    winRate: 52.5,
    usageRate: 15.0,
    defensiveScore: 80,
    offensiveScore: 70,
    roleDistributionEn: "Balanced (Offline Estimate)",
    roleDistributionZh: "均衡 (离线估算)",
    combosEn: ["Unit 1 Control -> Unit 2 AOE", "Unit 3 Support"],
    combosZh: ["单位1控制 -> 单位2AOE", "单位3辅助"],
    strengthsEn: ["General Coverage"],
    strengthsZh: ["一般打击面"],
    majorWeaknessesEn: ["Unknown"],
    majorWeaknessesZh: ["未知"],
    overallAnalysisEn: "Offline mode. Unable to calculate specific synergy for " + members.join(", "),
    overallAnalysisZh: "离线模式，无法计算协同评分。"
});

const generateContentWithRetry = async (client: any, params: any, maxRetries = 2) => {
  if (!client) throw new Error("No Client");
  let retries = 0;
  while (true) {
    try { return await client.models.generateContent(params); }
    catch (error: any) {
      if ((error.status === 429 || error.message?.includes('429')) && retries < maxRetries) {
        await new Promise(r => setTimeout(r, 3000 * (retries + 1)));
        retries++; continue;
      }
      throw error;
    }
  }
};
