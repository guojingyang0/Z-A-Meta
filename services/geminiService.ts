
import { GoogleGenAI, Type } from "@google/genai";
import { PokemonAnalysis, TeamRecommendation, MetaPokemonData, Language, Generation, Regulation, PokemonType } from '../types';
import { getEffectiveness } from '../constants';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment");
  }
  return new GoogleGenAI({ apiKey });
};

// In-memory cache
const teamCache: Record<string, TeamRecommendation> = {};
const metaCache: Record<string, MetaPokemonData[]> = {};

// Improved Translation Prompt referencing xzonn.top
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

// --- FALLBACK DATA FOR OFFLINE/QUOTA MODE ---
const FALLBACK_META_DATA: MetaPokemonData[] = [
    {
        rank: 1,
        nameEn: "Zygarde (Complete)",
        nameZh: "基格尔德 (完全形态)",
        id: 718,
        types: ["Dragon", "Ground"],
        usageRate: 88.5,
        keyMovesEn: ["Thousand Arrows", "Core Enforcer", "Dragon Dance", "Extreme Speed"],
        keyMovesZh: ["千箭齐发", "核心惩罚者", "龙之舞", "神速"],
        stats: { hp: 216, attack: 100, defense: 121, spAtk: 91, spDef: 95, speed: 85 },
        isAOE: true,
        hasCrowdControl: true,
        baseStatsTotal: 708,
        analysisEn: "The absolute god of Z-A. Massive HP and AOE Ground moves define the meta.",
        analysisZh: "Z-A时代的神。极高的HP与广域地面招式统治环境。",
        winRate: 0
    },
    {
        rank: 2,
        nameEn: "Mega Charizard Y",
        nameZh: "超级喷火龙Y",
        id: 6,
        types: ["Fire", "Flying"],
        usageRate: 76.2,
        keyMovesEn: ["Heat Wave", "Solar Beam", "Scorching Sands", "Roost"],
        keyMovesZh: ["热风", "日光束", "热沙大地", "羽栖"],
        stats: { hp: 78, attack: 104, defense: 78, spAtk: 159, spDef: 115, speed: 100 },
        isAOE: true,
        hasCrowdControl: false,
        baseStatsTotal: 634,
        analysisEn: "Sun-boosted Heat Wave melts everything. Ground coverage checks Rock types.",
        analysisZh: "晴天热风毁天灭地，地面系补盲完美覆盖岩石系。",
        winRate: 0
    },
    {
        rank: 3,
        nameEn: "Xerneas",
        nameZh: "哲尔尼亚斯",
        id: 716,
        types: ["Fairy"],
        usageRate: 65.4,
        keyMovesEn: ["Geomancy", "Moonblast", "Dazzling Gleam", "Focus Blast"],
        keyMovesZh: ["大地掌控", "月亮之力", "魔法闪耀", "真气弹"],
        stats: { hp: 126, attack: 131, defense: 95, spAtk: 131, spDef: 98, speed: 99 },
        isAOE: true,
        hasCrowdControl: true,
        baseStatsTotal: 680,
        analysisEn: "Geomancy setup makes it an unstoppable sweeper with Dazzling Gleam AOE.",
        analysisZh: "大地掌控强化后无人能挡，魔法闪耀提供恐怖的AOE压制。",
        winRate: 0
    },
    {
        rank: 4,
        nameEn: "Mega Kangaskhan",
        nameZh: "超级袋兽",
        id: 115,
        types: ["Normal"],
        usageRate: 58.1,
        keyMovesEn: ["Fake Out", "Double-Edge", "Sucker Punch", "Earthquake"],
        keyMovesZh: ["击掌奇袭", "舍身冲撞", "突袭", "地震"],
        stats: { hp: 105, attack: 125, defense: 100, spAtk: 60, spDef: 100, speed: 100 },
        isAOE: true,
        hasCrowdControl: true,
        baseStatsTotal: 590,
        analysisEn: "Parental Bond adds massive damage. Fake Out provides crucial CC.",
        analysisZh: "亲子爱特性伤害爆炸，击掌奇袭提供关键控制。",
        winRate: 0
    },
     {
        rank: 5,
        nameEn: "Mega Lucario",
        nameZh: "超级路卡利欧",
        id: 448,
        types: ["Fighting", "Steel"],
        usageRate: 45.0,
        keyMovesEn: ["Close Combat", "Meteor Mash", "Bullet Punch", "Swords Dance"],
        keyMovesZh: ["近身战", "彗星拳", "子弹拳", "剑舞"],
        stats: { hp: 70, attack: 145, defense: 88, spAtk: 140, spDef: 70, speed: 112 },
        isAOE: false,
        hasCrowdControl: false,
        baseStatsTotal: 625,
        analysisEn: "Adaptability Close Combat shreds tanks. Extreme mobility.",
        analysisZh: "适应力近身战撕碎坦克，极高的机动性。",
        winRate: 0
    },
    {
        rank: 6,
        nameEn: "Aegislash",
        nameZh: "坚盾剑怪",
        id: 681,
        types: ["Steel", "Ghost"],
        usageRate: 42.5,
        keyMovesEn: ["King's Shield", "Shadow Ball", "Flash Cannon", "Close Combat"],
        keyMovesZh: ["王者盾牌", "暗影球", "加农光炮", "近身战"],
        stats: { hp: 60, attack: 50, defense: 140, spAtk: 50, spDef: 140, speed: 60 },
        isAOE: false,
        hasCrowdControl: true,
        baseStatsTotal: 500,
        analysisEn: "Perfect defensive pivot. King's Shield is vital for blocking bursts.",
        analysisZh: "完美的防御中转，王者盾牌是格挡爆发的关键。",
        winRate: 0
    },
    {
        rank: 7,
        nameEn: "Yveltal",
        nameZh: "伊菲尔塔尔",
        id: 717,
        types: ["Dark", "Flying"],
        usageRate: 39.8,
        keyMovesEn: ["Dark Pulse", "Oblivion Wing", "Sucker Punch", "Heat Wave"],
        keyMovesZh: ["恶之波动", "死亡之翼", "突袭", "热风"],
        stats: { hp: 126, attack: 131, defense: 95, spAtk: 131, spDef: 98, speed: 99 },
        isAOE: true,
        hasCrowdControl: false,
        baseStatsTotal: 680,
        analysisEn: "Dark Aura boosts damage. Oblivion Wing provides infinite sustain.",
        analysisZh: "暗黑气场提升伤害，死亡之翼提供无限续航。",
        winRate: 0
    },
     {
        rank: 8,
        nameEn: "Mega Salamence",
        nameZh: "超级暴飞龙",
        id: 373,
        types: ["Dragon", "Flying"],
        usageRate: 35.2,
        keyMovesEn: ["Double-Edge", "Hyper Voice", "Roost", "Earthquake"],
        keyMovesZh: ["舍身冲撞", "巨声", "羽栖", "地震"],
        stats: { hp: 95, attack: 145, defense: 130, spAtk: 120, spDef: 90, speed: 120 },
        isAOE: true,
        hasCrowdControl: false,
        baseStatsTotal: 700,
        analysisEn: "Aerilate Hyper Voice is a massive ranged AOE nuke.",
        analysisZh: "飞行皮肤巨声是巨大的远程AOE核弹。",
        winRate: 0
    }
];

const FALLBACK_ANALYSIS: PokemonAnalysis = {
    nameEn: "Mega Charizard Y",
    nameZh: "超级喷火龙Y",
    types: ["Fire", "Flying"],
    roleEn: "Special Wallbreaker / Sun Setter",
    roleZh: "特攻爆破 / 晴天手",
    tier: "S",
    stats: { hp: 78, attack: 104, defense: 78, spAtk: 159, spDef: 115, speed: 100 },
    comparisonStats: { hp: 78, attack: 84, defense: 78, spAtk: 109, spDef: 85, speed: 100 },
    comparisonLabel: "Charizard",
    strengthsEn: ["Ferrothorn", "Scizor", "Zygarde (50%)"],
    strengthsZh: ["坚果哑铃", "巨钳螳螂", "基格尔德(50%)"],
    weaknessesEn: ["Tyranitar", "Stealth Rock", "Heatran"],
    weaknessesZh: ["班基拉斯", "隐形岩", "席多蓝恩"],
    coverageEn: ["Grass", "Ground", "Fighting"],
    coverageZh: ["草", "地面", "格斗"],
    partnersEn: ["Venusaur", "Walking Wake", "Torkoal"],
    partnersZh: ["妙蛙花", "波荡水", "煤炭龟"],
    matchupNetwork: [
         {
          opponentEn: "Zygarde (Complete)",
          opponentZh: "基格尔德(完全)",
          opponentTypes: ["Dragon", "Ground"],
          result: "lose",
          descriptionEn: "Cannot OHKO Zygarde, gets destroyed by Thousand Arrows.",
          descriptionZh: "无法确一基格尔德，被千箭齐发确一。"
        },
        {
          opponentEn: "Aegislash",
          opponentZh: "坚盾剑怪",
          opponentTypes: ["Steel", "Ghost"],
          result: "win",
          descriptionEn: "Heat Wave OHKOs regardless of form.",
          descriptionZh: "热风无视形态直接确一。"
        },
        {
          opponentEn: "Mega Lucario",
          opponentZh: "超级路卡利欧",
          opponentTypes: ["Fighting", "Steel"],
          result: "win",
          descriptionEn: "Resists Fighting moves and OHKOs with Fire moves.",
          descriptionZh: "抵抗格斗招式，火本确一。"
        },
        {
          opponentEn: "Xerneas",
          opponentZh: "哲尔尼亚斯",
          opponentTypes: ["Fairy"],
          result: "check",
          descriptionEn: "Sun boosted Fire moves hurt, but Geomancy outscales.",
          descriptionZh: "晴天火本伤害很高，但会被大地掌控反超。"
        },
         {
          opponentEn: "Mega Garchomp",
          opponentZh: "超级烈咬陆鲨",
          opponentTypes: ["Dragon", "Ground"],
          result: "lose",
          descriptionEn: "Outsped and OHKOd by Stone Edge.",
          descriptionZh: "速度劣势，被尖石攻击确一。"
        },
        {
          opponentEn: "Ferrothorn",
          opponentZh: "坚果哑铃",
          opponentTypes: ["Grass", "Steel"],
          result: "win",
          descriptionEn: "4x Weakness to Fire. Instant deletion.",
          descriptionZh: "4倍弱火，瞬间蒸发。"
        }
    ],
    summaryEn: "Mega Charizard Y is a premier wallbreaker in the Z-A meta. Its Drought ability instantly sets up sun, boosting its Fire-type moves to nuclear levels. Solar Beam covers its Water weakness perfectly.",
    summaryZh: "超级喷火龙Y是Z-A环境中顶级的破盾手。日照特性瞬间开启晴天，将其火系招式提升至核弹级别。日光束完美覆盖了水系弱点。"
};

/**
 * Helper to handle Rate Limits (429) with Exponential Backoff
 */
const generateContentWithRetry = async (client: any, params: any, maxRetries = 2) => {
  let retries = 0;
  let delay = 3000; // Increased start delay to 3 seconds

  while (true) {
    try {
      return await client.models.generateContent(params);
    } catch (error: any) {
      const msg = error.message || '';
      // Check for common Rate Limit error codes or messages
      const isQuotaError = 
        error.status === 429 || 
        error.code === 429 || 
        msg.includes('429') || 
        msg.includes('RESOURCE_EXHAUSTED') || 
        error.status === 'RESOURCE_EXHAUSTED';
      
      if (isQuotaError && retries < maxRetries) {
        console.warn(`Gemini API Quota Hit. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
        delay *= 2; // Exponential backoff
        continue;
      }
      
      // If quota error persists or other error, throw
      throw error;
    }
  }
};

/**
 * MATHEMATICAL MODEL: WIN RATE MATRIX
 * 
 * Calculates a win rate based on:
 * 1. Stat Dominance (Weighted: HP > Offense > Defense > Speed)
 * 2. Meta Matchups (Iterates through the entire provided list to check Type Advantages)
 * 3. Mechanics Bonuses (AOE, CC)
 */
const calculateMetaMatrix = (pokemonList: MetaPokemonData[], generation: Generation): MetaPokemonData[] => {
  if (!pokemonList || pokemonList.length === 0) return [];

  // Configurable Weights
  const WEIGHT_STATS = 0.35;
  const WEIGHT_MATCHUP = 0.45;
  const WEIGHT_MECHANICS = 0.20;

  // 1. Calculate Stat Scores (Normalized)
  const statScores = pokemonList.map(p => {
    // New Hierarchy Requested: HP (Highest) > Offense > Defense > Speed (Lowest)
    
    // HP: Critical for tanking hits (Base weight 2.0)
    const hpScore = p.stats.hp * 2.0;
    
    // Offense: Higher of Atk or SpA (Base weight 1.3)
    const offenseScore = Math.max(p.stats.attack, p.stats.spAtk) * 1.3;
    
    // Defense: Sum of Def/SpDef (Base weight 1.0)
    const defScore = (p.stats.defense + p.stats.spDef) * 1.0;
    
    // Speed: For Z-A, speed is ignored as per user request (Weight 0). For others, standard weight.
    const speedWeight = generation === 'legends-za' ? 0 : 0.4;
    const speedScore = p.stats.speed * speedWeight;

    return hpScore + offenseScore + defScore + speedScore;
  });
  
  const maxStatScore = Math.max(...statScores) || 1;
  const minStatScore = Math.min(...statScores) || 0;

  // 2. Calculate Matchup Matrix
  const matchupScores = pokemonList.map((subject, i) => {
    let totalAdvantage = 0;

    pokemonList.forEach((opponent, j) => {
      if (i === j) return; // Don't fight self

      // Offensive: Does Subject hit Opponent SE?
      // Check Subject's STABs (Same Type Attack Bonus) against Opponent
      let maxOffensiveMult = 0;
      subject.types.forEach(atkType => {
        let mult = 1;
        opponent.types.forEach(defType => {
            mult *= getEffectiveness(atkType as PokemonType, defType as PokemonType);
        });
        if (mult > maxOffensiveMult) maxOffensiveMult = mult;
      });

      // Defensive: Does Opponent hit Subject SE?
      let maxDefensiveMult = 0;
      opponent.types.forEach(atkType => {
        let mult = 1;
        subject.types.forEach(defType => {
            mult *= getEffectiveness(atkType as PokemonType, defType as PokemonType);
        });
        if (mult > maxDefensiveMult) maxDefensiveMult = mult;
      });

      // Score Delta:
      // If I hit you for 2x (2) and you hit me for 1x (1) -> Delta +1
      // If I hit you for 4x (4) and you hit me for 0.5x -> Delta +3.5
      totalAdvantage += (maxOffensiveMult - maxDefensiveMult);
    });

    return totalAdvantage;
  });

  const maxMatchup = Math.max(...matchupScores) || 1;
  const minMatchup = Math.min(...matchupScores) || 0;

  // 3. Final Calculation & Normalization
  return pokemonList.map((p, i) => {
    // Normalize Stats (0 to 1)
    const normStats = (statScores[i] - minStatScore) / (maxStatScore - minStatScore || 1);
    
    // Normalize Matchup (0 to 1)
    const normMatchup = (matchupScores[i] - minMatchup) / (maxMatchup - minMatchup || 1);

    // Mechanics Score (0 to 1)
    // AOE is huge in Z-A
    let mechScore = 0.5; // Base
    if (p.isAOE) mechScore += 0.3;
    if (p.hasCrowdControl) mechScore += 0.2;

    // Weighted Sum
    const rawScore = (normStats * WEIGHT_STATS) + (normMatchup * WEIGHT_MATCHUP) + (mechScore * WEIGHT_MECHANICS);

    // Map Raw Score (0-1) to Win Rate Percentage (45% - 78%)
    // Top meta mons rarely go above 80%, bad ones rarely below 40% in a balanced meta list
    const finalWinRate = 45 + (rawScore * 33);

    return {
        ...p,
        winRate: parseFloat(finalWinRate.toFixed(1))
    };
  });
};

const getGenContext = (gen: Generation, season: Regulation = 'season1'): string => {
  switch (gen) {
    case 'legends-za':
      let seasonRules = "";
      if (season === 'season1') {
        seasonRules = "WHITELIST: Kalos Dex ONLY. BANNED: Xerneas, Yveltal, Zygarde, Mewtwo.";
      } else if (season === 'season2') {
        seasonRules = "WHITELIST: Kalos Dex + Xerneas & Yveltal Unlocked. BANNED: Zygarde (Complete), Mewtwo.";
      } else if (season === 'season3') {
        seasonRules = "WHITELIST: Kalos Dex + All Kalos Legends (Including Zygarde Complete). BANNED: None (Restricted Format).";
      } else {
        seasonRules = "Standard Kalos Dex rules.";
      }
      return `Generation Context: Pokémon Legends Z-A.
      CRITICAL MECHANICS:
      1. This is an Action RPG (like Legends Arceus but modern).
      2. SPEED STAT is IGNORED for PvP evaluation in this context. Focus on Bulk and Raw Power.
      3. Moves have AREA OF EFFECT (AOE). Earthquake, Surf, Hyper Voice are Top Tier.
      4. NO ABILITIES exist in this format (like PLA).
      5. Mega Evolutions ARE allowed and central to the meta.
      ${seasonRules}`;
    
    case 'gen9':
      return "Generation Context: Gen 9 (Scarlet/Violet). Regulation H (No Legendaries/Paradox) or standard Ranked. Terastallization is key mechanic.";
    case 'gen8':
      return "Generation Context: Gen 8 (Sword/Shield). Dynamax is allowed.";
    case 'gen6':
      return "Generation Context: Gen 6 (X/Y). Mega Evolution is allowed.";
    default:
      return "Generation Context: Gen 9.";
  }
};

export const getMetaAnalysis = async (
  generation: Generation,
  season: Regulation
): Promise<MetaPokemonData[]> => {
  const cacheKey = `${generation}-${season}`;
  if (metaCache[cacheKey]) {
    return metaCache[cacheKey];
  }

  const client = getAiClient();
  const context = getGenContext(generation, season);

  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}

    Analyze the current competitive meta.
    Return a JSON list of the Top 16 most viable Pokémon (Optimized for grid view).
    
    CRITICAL SPEED OPTIMIZATION:
    - Keep 'analysisEn' and 'analysisZh' EXTREMELY CONCISE (Max 15 words).
    - Provide ACCURATE Base Stats and 'isAOE' flags for mathematical modeling.
    - LIST EXACTLY 4 MOVES in 'keyMovesEn' and 'keyMovesZh'.
    
    For 'isAOE': Set true if they commonly run Earthquake, Surf, Dazzling Gleam, Heat Wave, Hyper Voice, etc.
    For 'usageRate': Estimate based on tier popularity (0-100).

    Output strict JSON format:
    [
      {
        "rank": 1,
        "nameEn": "English Name",
        "nameZh": "Chinese Name",
        "id": 123,
        "types": ["Type1", "Type2"],
        "usageRate": 45.5,
        "keyMovesEn": ["Move1", "Move2", "Move3", "Move4"],
        "keyMovesZh": ["Move1_CN", "Move2_CN", "Move3_CN", "Move4_CN"],
        "stats": { "hp": 108, "attack": 130, "defense": 95, "spAtk": 80, "spDef": 85, "speed": 102 },
        "isAOE": true,
        "hasCrowdControl": false,
        "baseStatsTotal": 600,
        "analysisEn": "Short, punchy analysis.",
        "analysisZh": "简短有力的分析。"
      }
    ]
  `;

  try {
    const response = await generateContentWithRetry(client, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text || "[]";
    let parsed: MetaPokemonData[] = JSON.parse(rawText);

    // Apply Mathematical Model
    const calculatedData = calculateMetaMatrix(parsed, generation);

    metaCache[cacheKey] = calculatedData;
    return calculatedData;
  } catch (error) {
    console.error("Meta Analysis Error (Quota or other):", error);
    // FALLBACK: If API quota exceeded or error, return Static Mock Data
    console.warn("Using Fallback/Offline Meta Data due to API Error.");
    
    // Recalculate matrix for fallback data to ensure winrates are relative
    const fallbackCalculated = calculateMetaMatrix(FALLBACK_META_DATA, generation);
    return fallbackCalculated;
  }
};

export const analyzePokemon = async (
  pokemonName: string, 
  generation: Generation,
  season: Regulation
): Promise<PokemonAnalysis | null> => {
  const client = getAiClient();
  const context = getGenContext(generation, season);

  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}

    Analyze the Pokémon "${pokemonName}" for competitive viability.
    
    1. Provide detailed stats, roles, and matchups.
    2. Provide comparison stats for its "Base Form" or "Pre-Evolution" if this is a Mega or Evolved form.
    
    CRITICAL INSTRUCTION - COVERAGE:
    3. Coverage Types: You MUST list 2-4 distinct Types of attacking moves this Pokemon typically runs that are NOT its own STAB types.
       Example: Garchomp (Dragon/Ground) -> Coverage: ["Fire", "Rock"] (Fire Fang, Rock Slide).
       Example: Charizard Y (Fire/Flying) -> Coverage: ["Grass", "Ground", "Fighting"] (Solar Beam, Earthquake, Focus Blast).
       CRITICAL: NEVER return "None", "无", "Null" or an empty array.
       If the Pokemon truly has no coverage moves, return "Normal" or "Dark" as generic coverage.
    
    4. Matchup Network: Provide a list of 6-8 key meta matchups (other popular Pokemon). For each, specify 'result' (win/lose/check) and a brief 'description'.
       IMPORTANT: You MUST include "opponentTypes" (array of strings, e.g. ["Fire", "Flying"]) for each opponent to calculate the topology graph.

    Output strict JSON:
    {
      "nameEn": "Name",
      "nameZh": "Name CN",
      "types": ["Fire", "Flying"],
      "roleEn": "Wallbreaker",
      "roleZh": "破盾",
      "tier": "S",
      "stats": { "hp": 0, "attack": 0, "defense": 0, "spAtk": 0, "spDef": 0, "speed": 0 },
      "comparisonStats": { "hp": 0, "attack": 0, "defense": 0, "spAtk": 0, "spDef": 0, "speed": 0 },
      "comparisonLabel": "Base Form",
      "strengthsEn": ["Type1", "PokemonName"],
      "strengthsZh": ["Type1_CN", "PokemonName_CN"],
      "weaknessesEn": ["Type2", "PokemonName"],
      "weaknessesZh": ["Type2_CN", "PokemonName_CN"],
      "coverageEn": ["Fire", "Grass"],
      "coverageZh": ["火", "草"],
      "partnersEn": ["Pokemon1", "Pokemon2"],
      "partnersZh": ["Pokemon1_CN", "Pokemon2_CN"],
      "matchupNetwork": [
        {
          "opponentEn": "Garchomp",
          "opponentZh": "烈咬陆鲨",
          "opponentTypes": ["Dragon", "Ground"],
          "result": "win",
          "descriptionEn": "Outspeeds and OHKOs with Ice Beam.",
          "descriptionZh": "速度更快，冰冻光束确一。"
        }
      ],
      "summaryEn": "Summary.",
      "summaryZh": "Summary CN."
    }
  `;

  try {
    const response = await generateContentWithRetry(client, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Pokemon Analysis Error (Quota or other):", error);
    // FALLBACK: If specific pokemon analysis fails, try to return mock if it matches, or null
    // Ideally we would have a huge database, but for this demo, let's return a Generic Fallback 
    // if the user happened to click Charizard Y or Zygarde (common clicks).
    // Otherwise return null and let UI show error.
    
    const lowerName = pokemonName.toLowerCase();
    if (lowerName.includes('charizard') || lowerName.includes('喷火龙')) {
        return FALLBACK_ANALYSIS;
    }

    // For others, we unfortunately can't fabricate deep analysis on the fly without API.
    return null; 
  }
};

export const generateTeam = async (
  promptText: string,
  lang: Language,
  generation: Generation,
  season: Regulation
): Promise<TeamRecommendation | null> => {
  const cacheKey = `${generation}-${season}-${promptText}-${lang}`;
  if (teamCache[cacheKey]) return teamCache[cacheKey];

  const client = getAiClient();
  const context = getGenContext(generation, season);
  
  const abilityInstruction = generation === 'legends-za' 
    ? "Do NOT include Abilities (Mechanic not present in Z-A)." 
    : "Include Abilities.";

  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}
    ${abilityInstruction}

    Build a competitive team based on this user request: "${promptText}".
    Language Mode: ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.
    
    Output strict JSON:
    {
      "archetype": "Team Archetype Name",
      "explanation": "Brief explanation.",
      "members": [
        {
          "name": "Pokemon Name",
          "item": "Item Name",
          "ability": "Ability Name" (or "None"),
          "nature": "Nature Name",
          "moves": ["Move1", "Move2", "Move3", "Move4"],
          "role": "Role"
        }
      ]
    }
  `;

  try {
    const response = await generateContentWithRetry(client, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const result = JSON.parse(response.text);
    teamCache[cacheKey] = result;
    return result;
  } catch (error) {
    console.error("Team Gen Error (Quota or other):", error);
    return null;
  }
};
