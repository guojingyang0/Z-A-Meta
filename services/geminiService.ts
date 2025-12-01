import { GoogleGenAI } from "@google/genai";
import { PokemonAnalysis, TeamRecommendation, MetaPokemonData, TeamSynergyAnalysis, MetaTeamData, Language, Generation, Regulation, AISettings, AIProvider, PokemonType } from '../types';
import { getEffectiveness } from '../constants';
import * as dbService from './storageService';

// --- GLOBAL OFFLINE CIRCUIT BREAKER ---
let isGlobalOffline = false;

// Override for the specific user request if needed, but primarily relying on process.env
const DEFAULT_KEY = "AIzaSyBqJv79RZvmDrCXdWjVOtwg1ctRyjRz-JY"; // Fallback demo key

const getStoredSettings = (): AISettings | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem('za_meta_ai_settings');
    if (stored) return JSON.parse(stored);
  } catch (e) { return null; }
  return null;
};

// --- CACHING SYSTEM ---
const CACHE_PREFIX = 'za_meta_v3_'; 
const CACHE_TTL = 24 * 60 * 60 * 1000; 

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
// In-memory caches for fast switching during session
const metaCache: Record<string, MetaPokemonData[]> = {};
const metaTeamsCache: Record<string, MetaTeamData[]> = {}; 
const analysisCache: Record<string, PokemonAnalysis> = {};

export const clearMemoryCache = () => {
  const caches = [teamCache, metaCache, metaTeamsCache, analysisCache];
  caches.forEach(cache => {
    Object.keys(cache).forEach(key => delete cache[key]);
  });
};

// --- EXECUTION ENGINE ---

interface AIRequest {
    prompt: string;
    jsonMode?: boolean;
    defaultModel?: string;
}

const executeAIQuery = async (request: AIRequest): Promise<string> => {
    // 1. Get Settings (User preference)
    const settings = getStoredSettings();
    
    // 2. Determine Primary Config
    const provider: AIProvider = settings?.provider || 'gemini';
    const apiKey = settings?.apiKey || (typeof process !== 'undefined' && process.env.API_KEY ? process.env.API_KEY : DEFAULT_KEY);
    
    // Safety check for empty key if using custom settings (default logic handles fallback key)
    if (!apiKey) {
        throw new Error("No API Key Available");
    }

    try {
        // 3. Attempt Execution
        if (provider === 'openai') {
            return await executeOpenAI(settings!, request);
        } else {
            // Gemini
            if (settings && settings.baseUrl && settings.baseUrl.trim() !== '') {
                // Custom Gemini Endpoint (REST)
                return await executeGeminiRest(settings, request);
            } else {
                // Standard SDK
                return await executeGeminiSDK(apiKey, request);
            }
        }
    } catch (primaryError: any) {
        console.warn(`Primary AI Provider (${provider}) failed. Initiating fallback.`, primaryError.message);
        
        // 4. CROSS-PROVIDER FALLBACK
        const isUsingDefaultKey = apiKey === DEFAULT_KEY;
        const isGeminiDefault = provider === 'gemini' && (!settings?.baseUrl);
        
        if (isGeminiDefault && isUsingDefaultKey) {
            throw primaryError;
        }

        try {
            console.log("Attempting system fallback to Gemini Default...");
            const fallbackRequest = { ...request, defaultModel: 'gemini-1.5-flash' };
            return await executeGeminiSDK(DEFAULT_KEY, fallbackRequest);
        } catch (fallbackError) {
             console.error("Fallback failed", fallbackError);
             throw primaryError;
        }
    }
};

// Exposed for testing connection
export const testAPIConnection = async (settings: AISettings): Promise<{ success: boolean; message?: string }> => {
    const testRequest: AIRequest = {
        prompt: "Return JSON: { \"status\": \"ok\" }",
        jsonMode: true,
        defaultModel: settings.model || (settings.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash')
    };
    
    try {
        let result = "";
        if (settings.provider === 'openai') {
            result = await executeOpenAI(settings, testRequest);
        } else {
            if (settings.baseUrl && settings.baseUrl.trim() !== '') {
                result = await executeGeminiRest(settings, testRequest);
            } else {
                result = await executeGeminiSDK(settings.apiKey, testRequest);
            }
        }
        
        const isOk = result.includes("ok") || result.includes("status");
        return { success: isOk, message: isOk ? "Connected" : "Invalid Response Format" };
    } catch (e: any) {
        console.error("Connection Test Failed", e);
        let msg = e.message || "Unknown Error";
        
        if (msg.includes('429') || msg.includes('insufficient_quota')) {
            msg = "Quota Exceeded (429). Check your Plan/Billing.";
        } else if (msg.includes('401')) {
            msg = "Invalid API Key (401).";
        } else if (msg.includes('404')) {
            msg = "Model/Endpoint Not Found (404).";
        } else if (msg.includes('Failed to fetch')) {
            msg = "Network Error / CORS Blocked.";
        }
        
        return { success: false, message: msg };
    }
};

const executeOpenAI = async (settings: AISettings, request: AIRequest): Promise<string> => {
    let baseUrl = (settings.baseUrl || 'https://api.openai.com/v1').trim();
    const model = settings.model || 'gpt-4o-mini';
    
    baseUrl = baseUrl.replace(/\/+$/, '');
    if (!baseUrl.endsWith('/chat/completions')) {
        if (!baseUrl.endsWith('/v1')) {
            baseUrl = `${baseUrl}/v1`;
        }
        baseUrl = `${baseUrl}/chat/completions`;
    }
    
    const messages = [
        { role: 'user', content: request.prompt }
    ];

    const body: any = {
        model: model,
        messages: messages,
    };

    if (request.jsonMode) {
        body.response_format = { type: "json_object" };
    }

    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify(body),
            credentials: 'omit'
        });

        const contentType = response.headers.get('content-type');
        
        if (contentType && !contentType.includes('application/json')) {
             const text = await response.text();
             if (text.trim().startsWith('<')) {
                 throw new Error(`Endpoint returned HTML instead of JSON. Check your Base URL.`);
             }
             throw new Error(`OpenAI Endpoint returned non-JSON (${contentType}).`);
        }

        if (!response.ok) {
            const errText = await response.text();
            let errorMessage = `OpenAI Error ${response.status}`;
            
            try {
                const json = JSON.parse(errText);
                if (json.error) {
                    if (typeof json.error === 'string') {
                        errorMessage += `: ${json.error}`;
                    } else if (json.error.message) {
                        errorMessage += `: ${json.error.message}`;
                    } else if (json.error.code) {
                         errorMessage += `: ${json.error.code}`;
                    }
                } else {
                    errorMessage += `: ${errText.substring(0, 150)}`;
                }
            } catch (e) {
                errorMessage += `: ${errText.substring(0, 150)}`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (e) {
        console.error("OpenAI Fetch Failed", e);
        throw e;
    }
};

const GEMINI_FALLBACK_MODELS = [
    'gemini-1.5-flash', 
    'gemini-1.5-pro', 
    'gemini-2.0-flash-exp', 
    'gemini-pro'
];

const executeGeminiRest = async (settings: AISettings, request: AIRequest, attempt = 0): Promise<string> => {
    const baseUrl = (settings.baseUrl || 'https://generativelanguage.googleapis.com').trim();
    let model = settings.model || request.defaultModel || 'gemini-1.5-flash';
    
    if (attempt > 0) {
        if (attempt <= GEMINI_FALLBACK_MODELS.length) {
            model = GEMINI_FALLBACK_MODELS[attempt - 1];
            console.log(`[Gemini] Retrying with fallback model: ${model}`);
        } else {
            throw new Error("All Gemini fallback models failed.");
        }
    }
    
    let cleanBase = baseUrl.replace(/\/+$/, '');
    if (cleanBase.endsWith('/v1')) {
        cleanBase = cleanBase.substring(0, cleanBase.length - 3);
    }

    if (!cleanBase.includes('generateContent')) {
        if (cleanBase.includes('/models/')) {
             cleanBase = `${cleanBase}/${model}:generateContent`;
        } else {
             cleanBase = `${cleanBase}/v1beta/models/${model}:generateContent`;
        }
    }

    const url = `${cleanBase}?key=${settings.apiKey}`;
    const body: any = {
        contents: [{ parts: [{ text: request.prompt }] }]
    };

    if (request.jsonMode) {
        body.generationConfig = { responseMimeType: "application/json" };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            credentials: 'omit',
            mode: 'cors'
        });

        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) {
             const text = await response.text();
             if (text.trim().startsWith('<')) {
                 throw new Error(`Endpoint returned HTML. Check Base URL.`);
             }
             throw new Error(`Gemini Endpoint returned non-JSON (${contentType}).`);
        }

        if (!response.ok) {
             const errText = await response.text();
             if (response.status === 404 || response.status === 503) {
                 console.warn(`Gemini REST Error ${response.status} for model '${model}'.`);
                 return executeGeminiRest(settings, request, attempt + 1);
             }
             throw new Error(`Gemini REST Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        
        if (data.error) {
             if (data.error.code === 404 || data.error.code === 503 || (data.error.message && data.error.message.includes('not found'))) {
                  return executeGeminiRest(settings, request, attempt + 1);
             }
             throw new Error(`Gemini API Error: ${JSON.stringify(data.error)}`);
        }

        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e: any) {
        if (attempt < GEMINI_FALLBACK_MODELS.length && (e.message === 'Failed to fetch' || e.message.includes('Endpoint returned HTML'))) {
             return executeGeminiRest(settings, request, attempt + 1);
        }

        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
             console.warn("Gemini REST: Network unreachable. Switching to global offline mode.");
             isGlobalOffline = true;
             throw new Error("Network unreachable");
        }
        console.error("Gemini REST Failed", e);
        throw e;
    }
};

const executeGeminiSDK = async (apiKey: string, request: AIRequest): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    const modelId = request.defaultModel || 'gemini-1.5-flash';
    
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: request.prompt,
            config: request.jsonMode ? { responseMimeType: 'application/json' } : undefined
        });
        return response.text || "";
    } catch (e) {
        console.warn("Gemini SDK Failed, attempting REST fallback", e);
        return executeGeminiRest({
            provider: 'gemini',
            apiKey: apiKey,
        }, {
            ...request,
            defaultModel: 'gemini-1.5-flash'
        });
    }
};

// --- PRE-LOADED DATA ---

const FALLBACK_META_DATA: MetaPokemonData[] = [
    { 
        rank: 1, id: 718, nameEn: "Zygarde (Complete)", nameZh: "基格尔德(完全)", types: ["Dragon", "Ground"], usageRate: 92.5, 
        keyMovesEn: ["Thousand Arrows", "Dragon Dance", "Core Enforcer", "Rest"], keyMovesZh: ["千箭齐发", "龙之舞", "核心惩罚者", "睡觉"], 
        stats: { hp: 216, attack: 100, defense: 121, spAtk: 91, spDef: 95, speed: 85 }, isAOE: true, hasCrowdControl: true, baseStatsTotal: 708, 
        analysisEn: "The undisputed ruler. Huge HP + Thousand Arrows hits Flying types.", 
        analysisZh: "无可争议的环境统治者。超高耐久配合千箭齐发无视飞行系。", 
        winRate: 0 
    }
];

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
        analysisEn: "Zygarde acts as the anchor.",
        analysisZh: "基格尔德作为核心坦克。"
    },
];

const OFFICIAL_ZH_PROMPT = `
CRITICAL TRANSLATION RULES:
1. Use STRICT Official Nintendo Simplified Chinese translations (官方简体中文).
2. For Move Names, Ability Names, and Item Names, cross-reference with 'xzonn.top' or '52poke' standards.
3. FIX COMMON ERRORS - YOU MUST USE THESE EXACT TRANSLATIONS:
   [Moves]
   - 'Protect' -> '守住'
   - 'Detect' -> '看穿'
   - 'Spiky Shield' -> '尖刺防守'
   - 'King\'s Shield' -> '王者盾牌'
   - 'Baneful Bunker' -> '碉堡'
   - 'Silk Trap' -> '丝线陷阱'
   - 'Burning Bulwark' -> '火焰守护'
   - 'Obstruct' -> '拦堵'
   - 'Wide Guard' -> '广域防守'
   - 'Quick Guard' -> '快速防守'
   - 'Helping Hand' -> '帮助'
   - 'Follow Me' -> '看我嘛'
   - 'Rage Powder' -> '愤怒粉'
   - 'Tailwind' -> '顺风'
   - 'Trick Room' -> '戏法空间'
   - 'Icy Wind' -> '冰冻之风'
   - 'Electroweb' -> '电网'
   - 'Snarl' -> '大声咆哮'
   - 'Parting Shot' -> '抛下狠话'
   - 'Fake Out' -> '击掌奇袭'
   - 'Extreme Speed' -> '神速'
   - 'Sucker Punch' -> '突袭'
   - 'Accelerock' -> '冲岩'
   - 'Jet Punch' -> '水流喷射'
   - 'Ice Shard' -> '冰砾'
   - 'Shadow Sneak' -> '影子偷袭'
   - 'Aqua Jet' -> '水流喷射'
   - 'Bullet Punch' -> '子弹拳'
   - 'Mach Punch' -> '音速拳'
   - 'Vacuum Wave' -> '真空波'
   - 'Quick Attack' -> '电光一闪'
   - 'Feint' -> '佯攻'
   - 'First Impression' -> '迎头一击'
   - 'Thunderclap' -> '迅雷'
   - 'Upper Hand' -> '快手'
   - 'Close Combat' -> '近身战'
   - 'Brave Bird' -> '勇鸟猛攻'
   - 'U-turn' -> '急速折返'
   - 'Volt Switch' -> '伏特替换'
   - 'Flip Turn' -> '快速折返'
   - 'Knock Off' -> '拍落'
   - 'Stealth Rock' -> '隐形岩'
   - 'Defog' -> '清除浓雾'
   - 'Rapid Spin' -> '高速旋转'
   - 'Swords Dance' -> '剑舞'
   - 'Dragon Dance' -> '龙之舞'
   - 'Calm Mind' -> '冥想'
   - 'Nasty Plot' -> '诡计'
   - 'Roost' -> '羽栖'
   - 'Recover' -> '自我再生'
   - 'Slack Off' -> '偷懒'
   - 'Soft-Boiled' -> '生蛋'
   - 'Will-O-Wisp' -> '鬼火'
   - 'Thunder Wave' -> '电磁波'
   - 'Toxic' -> '剧毒'
   - 'Substitute' -> '替身'
   - 'Encore' -> '再来一次'
   - 'Taunt' -> '挑衅'
   - 'Play Rough' -> '嬉闹'
   - 'Moonblast' -> '月亮之力'
   - 'Dazzling Gleam' -> '魔法闪耀'
   - 'Earthquake' -> '地震'
   - 'High Horsepower' -> '十万马力'
   - 'Headlong Rush' -> '突飞猛扑'
   - 'Precipice Blades' -> '断崖之剑'
   - 'Thousand Arrows' -> '千箭齐发'
   - 'Core Enforcer' -> '核心惩罚者'
   - 'Oblivion Wing' -> '死亡之翼'
   - 'Geomancy' -> '大地掌控'
   - 'Scald' -> '热水'
   - 'Hydro Pump' -> '水炮'
   - 'Ice Beam' -> '冰冻光束'
   - 'Freeze-Dry' -> '冷冻干燥'
   - 'Thunderbolt' -> '十万伏特'
   - 'Shadow Ball' -> '暗影球'
   - 'Poltergeist' -> '灵骚'
   - 'Expanding Force' -> '广域战力'
   - 'Draco Meteor' -> '流星群'
   - 'Outrage' -> '逆鳞'
   - 'Scale Shot' -> '鳞射'
   - 'Iron Head' -> '铁头'
   - 'Flash Cannon' -> '加农光炮'
   - 'Heavy Slam' -> '重磅冲撞'
   - 'Salt Cure' -> '盐腌'
   - 'Population Bomb' -> '鼠数儿'
   - 'Rage Fist' -> '愤怒之拳'
   - 'Glaive Rush' -> '巨剑突击'
   - 'Flower Trick' -> '千变万花'
   - 'Torch Song' -> '闪焰高歌'
   - 'Aqua Step' -> '流水舞'
   - 'Ruination' -> '大灾难'
   - 'Collision Course' -> '全开猛撞'
   - 'Electro Drift' -> '闪电猛冲'
   
   [Pokemon/Abilities]
   - 'Flutter Mane' -> '振翼发'
   - 'Iron Bundle' -> '铁包袱'
   - 'Great Tusk' -> '雄伟牙'
   - 'Iron Hands' -> '铁臂膀'
   - 'Roaring Moon' -> '轰鸣月'
   - 'Iron Valiant' -> '铁武者'
   - 'Walking Wake' -> '波荡水'
   - 'Iron Leaves' -> '铁斑叶'
   - 'Gouging Fire' -> '破空焰'
   - 'Raging Bolt' -> '猛雷鼓'
   - 'Iron Boulder' -> '铁磐岩'
   - 'Iron Crown' -> '铁头壳'
   - 'Zygarde (Complete)' -> '基格尔德(完全)'
   - 'Protosynthesis' -> '古代活性'
   - 'Quark Drive' -> '夸克充能'
   - 'Orichalcum Pulse' -> '绯红脉动'
   - 'Hadron Engine' -> '强子引擎'
   - 'Intimidate' -> '威吓'
   - 'Levitate' -> '漂浮'
   - 'Flash Fire' -> '引火'
   - 'Prankster' -> '恶作剧之心'
   - 'Mold Breaker' -> '破格'
   - 'Beast Boost' -> '异兽提升'

4. Do NOT use literal translations if an official term exists.
`;

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
  if (!pokemonList || !Array.isArray(pokemonList) || pokemonList.length === 0) return [];
  
  const validList = pokemonList.filter(p => 
      p && p.stats && typeof p.stats.hp === 'number'
  );

  if (validList.length === 0) return [];

  const WEIGHT_STATS = 0.35, WEIGHT_MATCHUP = 0.45, WEIGHT_MECHANICS = 0.20;

  const statScores = validList.map(p => {
    const hpScore = p.stats.hp * 2.0;
    const offenseScore = Math.max(p.stats.attack, p.stats.spAtk) * 1.3;
    const defScore = (p.stats.defense + p.stats.spDef) * 1.0;
    const speedWeight = generation === 'legends-za' ? 0 : 0.4;
    return hpScore + offenseScore + defScore + (p.stats.speed * speedWeight);
  });
  
  const maxStat = Math.max(...statScores) || 1;
  const minStat = Math.min(...statScores) || 0;

  const matchupScores = validList.map((subject, i) => {
    let adv = 0;
    validList.forEach((opponent, j) => {
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

  return validList.map((p, i) => {
    const nStat = (statScores[i] - minStat) / (maxStat - minStat || 1);
    const nMatch = (matchupScores[i] - minMatch) / (maxMatch - minMatch || 1);
    let mech = 0.5;
    if (p.isAOE) mech += 0.3;
    if (p.hasCrowdControl) mech += 0.2;
    const raw = (nStat * WEIGHT_STATS) + (nMatch * WEIGHT_MATCHUP) + (mech * WEIGHT_MECHANICS);
    
    const calculatedDominance = parseFloat((10 + (raw * 80)).toFixed(1)); 
    
    return { 
        ...p, 
        winRate: parseFloat((45 + (raw * 35)).toFixed(1)),
        usageRate: calculatedDominance
    };
  }).sort((a, b) => b.winRate - a.winRate);
};

export const getMetaAnalysis = async (generation: Generation, season: Regulation): Promise<MetaPokemonData[]> => {
  const cacheKey = `meta-${generation}-${season}`;
  
  // 1. Check Memory Cache
  if (metaCache[cacheKey]) return metaCache[cacheKey];
  
  // 2. Check IndexedDB (Persistent Storage)
  try {
      const dbData = await dbService.getMeta(cacheKey);
      if (dbData && dbData.length > 0) {
          metaCache[cacheKey] = dbData;
          return dbData;
      }
  } catch (e) { console.warn("DB Read Fail", e); }

  // 3. Fallback / Offline 
  if (isGlobalOffline) {
    return calculateMetaMatrix(FALLBACK_META_DATA, generation);
  }

  const context = getGenContext(generation, season);
  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}
    Analyze the current competitive meta. Return a JSON list of the Top 12 most viable Pokémon.
    
    IMPORTANT: 
    - Treat distinct Mega Evolutions (e.g. Mega Charizard X vs Mega Charizard Y) as SEPARATE Pokémon entries.
    - Treat Regional Variants (e.g. Hisuian, Alolan) as distinct entries.
    - Provide insightful tactical commentary (25-40 words).
    - Explain WHY they are strong (CDR, AOE, Bulk).
    - DO NOT MENTION ABILITIES unless crucial for Mega Evolution.
    
    Output strict JSON format (Array of objects).
    Each object MUST have:
    - rank (number)
    - nameEn (string)
    - nameZh (string)
    - id (number, National Dex ID)
    - types (string array)
    - usageRate (number 0-100)
    - stats: { hp, attack, defense, spAtk, spDef, speed }
    - keyMovesEn (string array)
    - keyMovesZh (string array)
    - analysisEn (string)
    - analysisZh (string)
    - isAOE (boolean)
    - hasCrowdControl (boolean)
    - baseStatsTotal (number)
  `;

  try {
    const text = await executeAIQuery({
        prompt: prompt,
        jsonMode: true,
        defaultModel: 'gemini-1.5-flash'
    });
    const parsed: MetaPokemonData[] = JSON.parse(text || "[]");
    
    const calculatedData = calculateMetaMatrix(parsed, generation);
    if (calculatedData.length === 0) throw new Error("No valid data derived");

    metaCache[cacheKey] = calculatedData;
    // Persist to DB
    await dbService.saveMeta(cacheKey, calculatedData);
    
    return calculatedData;
  } catch (error) {
    console.warn("Meta Analysis Failed, using fallback", error);
    return calculateMetaMatrix(FALLBACK_META_DATA, generation);
  }
};

export const getMetaTeams = async (generation: Generation, season: Regulation): Promise<MetaTeamData[]> => {
  const cacheKey = `meta-teams-${generation}-${season}`;
  if (metaTeamsCache[cacheKey]) return metaTeamsCache[cacheKey];

  try {
    const dbData = await dbService.getMetaTeams(cacheKey);
    if (dbData && dbData.length > 0) {
        metaTeamsCache[cacheKey] = dbData;
        return dbData;
    }
  } catch (e) { }

  if (isGlobalOffline) return FALLBACK_TEAMS;

  const context = getGenContext(generation, season);
  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}
    Analyze the current competitive meta and identify the Top 6 most powerful 3-Pokémon Core Squads (Teams).
    
    RULES:
    1. WHITELIST: KALOS REGIONAL POKEDEX ONLY.
    2. RESTRICTED LEGENDARIES: MAX 1 per team.
    3. TEAM SIZE: Exactly 3 Pokémon.

    Output strict JSON format (Array of objects).
    Ensure 'members' is an array of English names and 'membersZh' is an array of Chinese names.
    Include numeric 'winRate', 'usageRate', 'synergyScore'.
  `;

  try {
    const text = await executeAIQuery({
        prompt: prompt,
        jsonMode: true,
        defaultModel: 'gemini-1.5-flash'
    });
    const parsed: MetaTeamData[] = JSON.parse(text || "[]");
    metaTeamsCache[cacheKey] = parsed;
    await dbService.saveMetaTeams(cacheKey, parsed);
    return parsed;
  } catch (error) {
    return FALLBACK_TEAMS;
  }
};

export const analyzePokemon = async (pokemonName: string, generation: Generation, season: Regulation): Promise<PokemonAnalysis | null> => {
  const normalizedName = pokemonName.trim().toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
  const cacheKey = `analysis-${generation}-${season}-${normalizedName}`;

  if (analysisCache[cacheKey]) return analysisCache[cacheKey];

  try {
    const dbData = await dbService.getAnalysis(cacheKey);
    if (dbData) {
        analysisCache[cacheKey] = dbData;
        return dbData;
    }
  } catch (e) { }

  if (isGlobalOffline) return null;

  const context = getGenContext(generation, season);
  const prompt = `
    ${context}
    ${OFFICIAL_ZH_PROMPT}
    Analyze the Pokémon "${pokemonName}" for competitive viability.
    
    CRITICAL INSTRUCTIONS:
    1. Coverage Types MUST list 2-4 distinct non-STAB move types.
    2. Summary MUST be detailed and strategic (50-80 words). 
    3. DO NOT MENTION ABILITIES unless crucial for Mega Evolution. Focus on Stats, Typing, AOE, and Speed(CDR).
    4. RELATED FORMS: List Mega Evolutions, Regional Forms (Hisuian/Alolan), or Forms (Complete) in 'relatedForms'.
    5. VIABLE MOVEPOOL: Provide a comprehensive list of the 8-15 most viable competitive moves (both attacking and utility) in 'movepoolEn' and 'movepoolZh'.
    6. MATCHUP NETWORK: Generate 5-7 specific matchups (Win/Lose/Check) against relevant meta threats.
    
    Output strict JSON matching this structure:
    {
      "nameEn": string,
      "nameZh": string,
      "types": string[],
      "roleEn": string,
      "roleZh": string,
      "tier": string,
      "stats": { "hp": number, "attack": number, "defense": number, "spAtk": number, "spDef": number, "speed": number },
      "comparisonStats": { "hp": number, "attack": number, "defense": number, "spAtk": number, "spDef": number, "speed": number } (Optional, for base form),
      "comparisonLabel": string (Optional),
      "strengthsEn": string[],
      "strengthsZh": string[],
      "weaknessesEn": string[],
      "weaknessesZh": string[],
      "coverageEn": string[],
      "coverageZh": string[],
      "movepoolEn": string[],
      "movepoolZh": string[],
      "partnersEn": string[],
      "partnersZh": string[],
      "matchupNetwork": [
        {
           "opponentEn": string,
           "opponentZh": string,
           "opponentTypes": string[],
           "result": "win" | "lose" | "check",
           "descriptionEn": string,
           "descriptionZh": string
        }
      ],
      "summaryEn": string,
      "summaryZh": string,
      "relatedForms": string[]
    }
  `;

  try {
    const text = await executeAIQuery({
        prompt: prompt,
        jsonMode: true,
        defaultModel: 'gemini-1.5-flash'
    });
    const result = JSON.parse(text);
    
    if (!result.stats || typeof result.stats.hp !== 'number') {
        throw new Error("Invalid stats received from AI");
    }

    analysisCache[cacheKey] = result;
    await dbService.saveAnalysis(cacheKey, result);
    return result;
  } catch (error) {
    return null;
  }
};

export const generateTeam = async (promptText: string, lang: Language, generation: Generation, season: Regulation): Promise<TeamRecommendation | null> => {
  const cacheKey = `team-${generation}-${season}-${promptText.trim()}-${lang}`;
  if (teamCache[cacheKey]) return teamCache[cacheKey];
  const localData = getLocalStorage<TeamRecommendation>(cacheKey);
  if (localData) { teamCache[cacheKey] = localData; return localData; }

  if (isGlobalOffline) return null;

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
    const text = await executeAIQuery({
        prompt: prompt,
        jsonMode: true,
        defaultModel: 'gemini-1.5-flash'
    });
    const result = JSON.parse(text);
    teamCache[cacheKey] = result;
    setLocalStorage(cacheKey, result);
    return result;
  } catch (error) {
    return null;
  }
};
