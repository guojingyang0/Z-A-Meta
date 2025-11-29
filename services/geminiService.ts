import { GoogleGenAI, Type } from "@google/genai";
import { PokemonAnalysis, TeamRecommendation, MetaPokemonData, Language, Generation, Regulation, PokemonType } from '../types';
import { getEffectiveness } from '../constants';

// --- GLOBAL OFFLINE CIRCUIT BREAKER ---
let isGlobalOffline = false;

const getAiClient = () => {
  if (isGlobalOffline) return null;
  // Runtime safety check for process.env
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
  if (!apiKey) {
    console.warn("API Key not found. Using Offline Mode.");
    isGlobalOffline = true;
    return null; 
  }
  return new GoogleGenAI({ apiKey });
};

// --- CACHING SYSTEM ---
const CACHE_PREFIX = 'za_meta_v1_';
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
const analysisCache: Record<string, PokemonAnalysis> = {};

// --- PRE-LOADED "Z-A SEASON 3" DATABASE (TOP 12) ---
// UPDATED: Rich Text, No Abilities, Focus on Z-A Mechanics (CDR, AOE, Stats)

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
    },
    { 
        rank: 7, id: 717, nameEn: "Yveltal", nameZh: "伊菲尔塔尔", types: ["Dark", "Flying"], usageRate: 55.2, 
        keyMovesEn: ["Oblivion Wing", "Dark Pulse", "Sucker Punch", "Snarl"], keyMovesZh: ["死亡之翼", "恶之波动", "突袭", "大声咆哮"], 
        stats: { hp: 126, attack: 131, defense: 95, spAtk: 131, spDef: 98, speed: 99 }, isAOE: true, hasCrowdControl: false, baseStatsTotal: 680, 
        analysisEn: "The ultimate drain tank. 'Oblivion Wing' heals for a massive percentage of damage dealt, allowing Yveltal to sustain through prolonged engagements without needing external healing.", 
        analysisZh: "顶级的吸血坦克。“死亡之翼”能回复造成伤害的极高比例血量，使伊菲尔塔尔能在长期交战中维持血线，无需依赖外部治疗。", 
        winRate: 0 
    },
    { 
        rank: 8, id: 94, nameEn: "Mega Gengar", nameZh: "超级耿鬼", types: ["Ghost", "Poison"], usageRate: 48.9, 
        keyMovesEn: ["Shadow Ball", "Sludge Bomb", "Destiny Bond", "Icy Wind"], keyMovesZh: ["暗影球", "污泥炸弹", "同命", "冰冻之风"], 
        stats: { hp: 60, attack: 65, defense: 80, spAtk: 170, spDef: 95, speed: 130 }, isAOE: true, hasCrowdControl: true, baseStatsTotal: 600, 
        analysisEn: "130 Speed grants instant cooldowns on high-damage spells like 'Sludge Bomb'. 'Destiny Bond' is a strategic nuke that can force a trade with the enemy's strongest unit.", 
        analysisZh: "130 的速度赋予了“污泥炸弹”等高伤技能极短的冷却。“同命”是一个战略级核弹，能强制与敌方最强的单位进行一换一。", 
        winRate: 0 
    },
    { 
        rank: 9, id: 373, nameEn: "Mega Salamence", nameZh: "超级暴飞龙", types: ["Dragon", "Flying"], usageRate: 45.3, 
        keyMovesEn: ["Hyper Voice", "Double-Edge", "Roost", "Earthquake"], keyMovesZh: ["巨声", "舍身冲撞", "羽栖", "地震"], 
        stats: { hp: 95, attack: 145, defense: 130, spAtk: 120, spDef: 90, speed: 120 }, isAOE: true, hasCrowdControl: false, baseStatsTotal: 700, 
        analysisEn: "A versatile mixed attacker with immense physical bulk (130 Def). 'Hyper Voice' provides reliable ranged AOE damage, while its speed ensures rapid repositioning.", 
        analysisZh: "全能的双刀攻击手，拥有高达 130 的物理防御。“巨声”提供稳定的远程 AOE，而 120 的速度保证了其快速切入和脱离战场的能力。", 
        winRate: 0 
    },
    { 
        rank: 10, id: 150, nameEn: "Mega Mewtwo Y", nameZh: "超级超梦Y", types: ["Psychic"], usageRate: 42.1, 
        keyMovesEn: ["Psystrike", "Ice Beam", "Focus Blast", "Calm Mind"], keyMovesZh: ["精神击破", "冰冻光束", "真气弹", "冥想"], 
        stats: { hp: 106, attack: 150, defense: 70, spAtk: 194, spDef: 120, speed: 140 }, isAOE: false, hasCrowdControl: false, baseStatsTotal: 780, 
        analysisEn: "The highest Special Attack (194) in the game. 'Psystrike' hits the opponent's Defense stat, allowing it to break special walls. Extremely fragile physically.", 
        analysisZh: "拥有 194 特攻和 140 速度，具备全游戏最高的进攻上限。“精神击破”打击对手的物理防御，使其能突破特盾。物理耐久极低，非常脆弱。", 
        winRate: 0 
    },
    { 
        rank: 11, id: 282, nameEn: "Mega Gardevoir", nameZh: "超级沙奈朵", types: ["Psychic", "Fairy"], usageRate: 40.0, 
        keyMovesEn: ["Hyper Voice", "Psyshock", "Mystical Fire", "Trick Room"], keyMovesZh: ["巨声", "精神冲击", "魔法火焰", "戏法空间"], 
        stats: { hp: 68, attack: 85, defense: 65, spAtk: 165, spDef: 135, speed: 100 }, isAOE: true, hasCrowdControl: true, baseStatsTotal: 618, 
        analysisEn: "A specialized special wallbreaker. 'Hyper Voice' ignores substitutes and hits wide areas. 'Trick Room' can reverse speed advantages, disrupting fast assassins.", 
        analysisZh: "特化的特攻爆破手。“巨声”能穿透替身并打击大范围区域。“戏法空间”可以反转速度优势，打乱高速刺客的节奏。", 
        winRate: 0 
    },
    { 
        rank: 12, id: 257, nameEn: "Mega Blaziken", nameZh: "超级火焰鸡", types: ["Fire", "Fighting"], usageRate: 38.5, 
        keyMovesEn: ["Flare Blitz", "Close Combat", "Protect", "Swords Dance"], keyMovesZh: ["闪焰冲锋", "近身战", "守住", "剑舞"], 
        stats: { hp: 80, attack: 160, defense: 80, spAtk: 130, spDef: 80, speed: 100 }, isAOE: false, hasCrowdControl: false, baseStatsTotal: 630, 
        analysisEn: "Even without Speed Boost, its high base Speed and Attack make it a formidable sweeper. High mobility allows it to close gaps and land devastating 'Close Combats'.", 
        analysisZh: "即使没有加速特性，其优秀的速度和攻击种族值仍让它成为可怕的推队手。高机动性使其能快速接近敌人并打出毁灭性的“近身战”。", 
        winRate: 0 
    }
];

const PRELOADED_ANALYSIS_MAP: Record<string, PokemonAnalysis> = {};
const addPreloaded = (data: PokemonAnalysis) => {
    PRELOADED_ANALYSIS_MAP[data.nameEn.toLowerCase()] = data;
    PRELOADED_ANALYSIS_MAP[data.nameZh] = data;
    if (data.nameEn.includes("Mega ")) PRELOADED_ANALYSIS_MAP[data.nameEn.replace("Mega ", "").toLowerCase()] = data;
    if (data.nameEn.includes(" (Complete)")) PRELOADED_ANALYSIS_MAP["zygarde"] = data;
};

// 1. Zygarde Complete
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

// 2. Mega Charizard Y
addPreloaded({
    nameEn: "Mega Charizard Y", nameZh: "超级喷火龙Y", types: ["Fire", "Flying"], roleEn: "Special AOE Nuke", roleZh: "特攻AOE核弹", tier: "S",
    stats: { hp: 78, attack: 104, defense: 78, spAtk: 159, spDef: 115, speed: 100 },
    comparisonStats: { hp: 78, attack: 84, defense: 78, spAtk: 109, spDef: 85, speed: 100 },
    strengthsEn: ["Ferrothorn", "Scizor"], strengthsZh: ["坚果哑铃", "巨钳螳螂"],
    weaknessesEn: ["Stealth Rock", "Stone Edge"], weaknessesZh: ["隐形岩", "尖石攻击"],
    coverageEn: ["Grass", "Ground", "Fighting"], coverageZh: ["草", "地面", "格斗"],
    partnersEn: ["Torkoal", "Venusaur"], partnersZh: ["煤炭龟", "妙蛙花"],
    matchupNetwork: [
        { opponentEn: "Ferrothorn", opponentZh: "坚果哑铃", opponentTypes: ["Grass", "Steel"], result: "win", descriptionEn: "Instant OHKO with Fire moves.", descriptionZh: "火系招式瞬间确一。" },
        { opponentEn: "Mega Tyranitar", opponentZh: "超级班基拉斯", opponentTypes: ["Rock", "Dark"], result: "lose", descriptionEn: "Weak to Rock moves.", descriptionZh: "弱岩石系招式。" }
    ],
    summaryEn: "Boasting 159 Sp.Atk, Charizard Y is a premier wallbreaker. 'Heat Wave' offers massive AOE pressure, while 'Solar Beam' (with support) covers its Water weakness. Its high special defense allows it to duel other special attackers.",
    summaryZh: "凭借 159 的特攻，超级喷火龙Y是顶级的破盾手。“热风”提供巨大的 AOE 压制力，而“日光束”完美覆盖了水系弱点。其高额的特防使其能与其他特攻手对攻。"
});

// 3. Xerneas
addPreloaded({
    nameEn: "Xerneas", nameZh: "哲尔尼亚斯", types: ["Fairy"], roleEn: "Setup Hyper Carry", roleZh: "强化大核", tier: "S",
    stats: { hp: 126, attack: 131, defense: 95, spAtk: 131, spDef: 98, speed: 99 },
    comparisonStats: undefined, comparisonLabel: undefined,
    strengthsEn: ["Yveltal", "Zygarde", "Dragons"], strengthsZh: ["伊菲尔塔尔", "基格尔德", "龙系"],
    weaknessesEn: ["Mega Scizor", "Sludge Bomb"], weaknessesZh: ["超级巨钳螳螂", "污泥炸弹"],
    coverageEn: ["Electric", "Fighting", "Grass"], coverageZh: ["电", "格斗", "草"],
    partnersEn: ["Groudon", "Incineroar"], partnersZh: ["固拉多", "炽焰咆哮虎"],
    matchupNetwork: [
        { opponentEn: "Yveltal", opponentZh: "伊菲尔塔尔", opponentTypes: ["Dark", "Flying"], result: "win", descriptionEn: "Type advantage wins.", descriptionZh: "属性压制获胜。" },
        { opponentEn: "Mega Scizor", opponentZh: "超级巨钳螳螂", opponentTypes: ["Bug", "Steel"], result: "lose", descriptionEn: "Weak to Steel moves.", descriptionZh: "弱钢系招式。" }
    ],
    summaryEn: "Defined by 'Geomancy', which boosts Sp.Atk, Sp.Def, and Speed by 2 stages. In a format without abilities, stats are king, and Xerneas has the best stat-boosting move in the game. 'Moonblast' hits immensely hard.",
    summaryZh: "其核心在于“大地掌控”，能同时提升特攻、特防和速度 2 级。在没有特性的环境里，面板数值就是王道，而哲尔尼亚斯拥有最强的强化技能。“月亮之力”的单点爆发极高。"
});

// 4. Mega Kangaskhan
addPreloaded({
    nameEn: "Mega Kangaskhan", nameZh: "超级袋兽", types: ["Normal"], roleEn: "Physical Brawler", roleZh: "物理斗士", tier: "A+",
    stats: { hp: 105, attack: 125, defense: 100, spAtk: 60, spDef: 100, speed: 100 },
    comparisonStats: { hp: 105, attack: 95, defense: 80, spAtk: 40, spDef: 80, speed: 90 },
    strengthsEn: ["Glass Cannons"], strengthsZh: ["脆皮输出"],
    weaknessesEn: ["Fighting", "Rocky Helmet"], weaknessesZh: ["格斗", "凸凸头盔"],
    coverageEn: ["Ground", "Fighting", "Ice"], coverageZh: ["地面", "格斗", "冰"],
    partnersEn: ["Clefairy", "Cresselia"], partnersZh: ["皮皮", "克雷色利亚"],
    matchupNetwork: [
        { opponentEn: "Mega Gengar", opponentZh: "超级耿鬼", opponentTypes: ["Ghost", "Poison"], result: "check", descriptionEn: "Sucker Punch hits hard.", descriptionZh: "突袭伤害很高。" },
        { opponentEn: "Mega Lucario", opponentZh: "超级路卡利欧", opponentTypes: ["Fighting", "Steel"], result: "lose", descriptionEn: "Weak to Fighting.", descriptionZh: "弱格斗。" }
    ],
    summaryEn: "An all-rounder with excellent bulk (105/100/100) and Attack. 'Fake Out' is invaluable for disrupting enemy casts. 'Sucker Punch' provides priority to pick off weakened foes. A stable physical anchor.",
    summaryZh: "极其全面的战士，拥有优秀的耐久（105/100/100）和攻击力。“击掌奇袭”打断敌人施法非常有价值。“突袭”提供的先制攻击能收割残血敌人。非常稳健的物理核心。"
});

// 5. Mega Lucario
addPreloaded({
    nameEn: "Mega Lucario", nameZh: "超级路卡利欧", types: ["Fighting", "Steel"], roleEn: "High-Speed DPS", roleZh: "高速DPS", tier: "A+",
    stats: { hp: 70, attack: 145, defense: 88, spAtk: 140, spDef: 70, speed: 112 },
    comparisonStats: { hp: 70, attack: 110, defense: 70, spAtk: 115, spDef: 70, speed: 90 },
    strengthsEn: ["Kangaskhan", "Tyranitar"], strengthsZh: ["袋兽", "班基拉斯"],
    weaknessesEn: ["Fire", "Ground", "Fighting"], weaknessesZh: ["火", "地面", "格斗"],
    coverageEn: ["Rock", "Ice", "Dark"], coverageZh: ["岩石", "冰", "恶"],
    partnersEn: ["Togekiss", "Landorus"], partnersZh: ["波克基斯", "土地云"],
    matchupNetwork: [
        { opponentEn: "Mega Kangaskhan", opponentZh: "超级袋兽", opponentTypes: ["Normal"], result: "win", descriptionEn: "Close Combat OHKOs.", descriptionZh: "近身战确一。" },
        { opponentEn: "Mega Charizard Y", opponentZh: "超级喷火龙Y", opponentTypes: ["Fire", "Flying"], result: "lose", descriptionEn: "Weak to Fire.", descriptionZh: "弱火。" }
    ],
    summaryEn: "With 112 Speed converting to low cooldowns, and mixed offensive stats (145/140), Lucario is a DPS machine. 'Close Combat' shreds Steel and Normal types, while 'Flash Cannon' handles Fairies.",
    summaryZh: "112 的速度转化为极低的技能冷却，配合极高的双刀种族值（145/140），路卡利欧是一台 DPS 机器。“近身战”撕碎钢系和一般系，“加农光炮”则用来处理妖精系。"
});

// 6. Aegislash
addPreloaded({
    nameEn: "Aegislash", nameZh: "坚盾剑怪", types: ["Steel", "Ghost"], roleEn: "Stance Change Pivot", roleZh: "双形态中转", tier: "A",
    stats: { hp: 60, attack: 50, defense: 140, spAtk: 50, spDef: 140, speed: 60 },
    comparisonStats: { hp: 60, attack: 140, defense: 50, spAtk: 140, spDef: 50, speed: 60 }, comparisonLabel: "Blade Form",
    strengthsEn: ["Xerneas", "Fighting Types"], strengthsZh: ["哲尔尼亚斯", "格斗系"],
    weaknessesEn: ["Ground", "Fire", "Ghost"], weaknessesZh: ["地面", "火", "幽灵"],
    coverageEn: ["Fighting", "Rock"], coverageZh: ["格斗", "岩石"],
    partnersEn: ["Hydreigon", "Kommo-o"], partnersZh: ["三首恶龙", "杖尾鳞甲龙"],
    matchupNetwork: [
        { opponentEn: "Xerneas", opponentZh: "哲尔尼亚斯", opponentTypes: ["Fairy"], result: "check", descriptionEn: "Resists Fairy, hits back hard.", descriptionZh: "抵抗妖精，反击伤害高。" },
        { opponentEn: "Mega Charizard Y", opponentZh: "超级喷火龙Y", opponentTypes: ["Fire", "Flying"], result: "lose", descriptionEn: "Weak to Fire.", descriptionZh: "弱火。" }
    ],
    summaryEn: "Uniquely shifts stats between offense and defense. In Shield Forme, 140 defenses make it a wall. In Blade Forme, 140 offenses make it a breaker. 'King's Shield' is essential for survival.",
    summaryZh: "独特的攻防转换机制。盾牌形态下 140 的双防让它坚不可摧，刀剑形态下 140 的双攻则极其致命。“王者盾牌”是生存和形态切换的关键。"
});

// 7. Yveltal
addPreloaded({
    nameEn: "Yveltal", nameZh: "伊菲尔塔尔", types: ["Dark", "Flying"], roleEn: "Sustain Bruiser", roleZh: "续航型斗士", tier: "S",
    stats: { hp: 126, attack: 131, defense: 95, spAtk: 131, spDef: 98, speed: 99 },
    comparisonStats: undefined,
    strengthsEn: ["Psychic Types", "Ghost Types"], strengthsZh: ["超能系", "幽灵系"],
    weaknessesEn: ["Fairy", "Electric", "Rock"], weaknessesZh: ["妖精", "电", "岩石"],
    coverageEn: ["Fighting", "Fire", "Flying"], coverageZh: ["格斗", "火", "飞行"],
    partnersEn: ["Necrozma-DM", "Eternatus"], partnersZh: ["日食奈克洛兹玛", "无极汰那"],
    matchupNetwork: [
        { opponentEn: "Mega Mewtwo Y", opponentZh: "超级超梦Y", opponentTypes: ["Psychic"], result: "win", descriptionEn: "Immune to Psychic.", descriptionZh: "免疫超能系。" },
        { opponentEn: "Xerneas", opponentZh: "哲尔尼亚斯", opponentTypes: ["Fairy"], result: "lose", descriptionEn: "Weak to Fairy.", descriptionZh: "弱妖精系。" }
    ],
    summaryEn: "Excellent mixed stats and HP. 'Oblivion Wing' provides sustainability that few other Pokemon can match, allowing it to stay in the fight longer. 'Sucker Punch' adds priority threat.",
    summaryZh: "优秀的双刀种族值和 HP。“死亡之翼”提供了其他宝可梦难以企及的续航能力，使其能长期站场作战。“突袭”则增加了先制威胁。"
});

// 8. Mega Gengar
addPreloaded({
    nameEn: "Mega Gengar", nameZh: "超级耿鬼", types: ["Ghost", "Poison"], roleEn: "Fast Assassin", roleZh: "高速刺客", tier: "S",
    stats: { hp: 60, attack: 65, defense: 80, spAtk: 170, spDef: 95, speed: 130 },
    comparisonStats: { hp: 60, attack: 65, defense: 60, spAtk: 130, spDef: 75, speed: 110 },
    strengthsEn: ["Fairies", "Passive Walls"], strengthsZh: ["妖精系", "受队盾牌"],
    weaknessesEn: ["Ground", "Psychic", "Ghost"], weaknessesZh: ["地面", "超能", "幽灵"],
    coverageEn: ["Ice", "Electric", "Fighting"], coverageZh: ["冰", "电", "格斗"],
    partnersEn: ["Yveltal", "Groudon"], partnersZh: ["伊菲尔塔尔", "固拉多"],
    matchupNetwork: [
        { opponentEn: "Xerneas", opponentZh: "哲尔尼亚斯", opponentTypes: ["Fairy"], result: "win", descriptionEn: "Sludge Bomb is super effective.", descriptionZh: "污泥炸弹效果拔群。" },
        { opponentEn: "Yveltal", opponentZh: "伊菲尔塔尔", opponentTypes: ["Dark", "Flying"], result: "lose", descriptionEn: "Weak to Dark.", descriptionZh: "弱恶系。" }
    ],
    summaryEn: "130 Speed and 170 Sp.Atk create a terrifying assassin profile. High speed means very low cooldowns in Z-A. 'Sludge Bomb' threatens Fairies like Xerneas, while 'Shadow Ball' offers consistent STAB.",
    summaryZh: "130 的速度和 170 的特攻使其成为恐怖的刺客。高速度在 Z-A 中意味着极短的技能冷却。“污泥炸弹”能有效威胁哲尔尼亚斯等妖精系，而“暗影球”提供稳定的本系输出。"
});

// 9. Mega Salamence
addPreloaded({
    nameEn: "Mega Salamence", nameZh: "超级暴飞龙", types: ["Dragon", "Flying"], roleEn: "Physical Sweeper", roleZh: "物攻推队", tier: "A+",
    stats: { hp: 95, attack: 145, defense: 130, spAtk: 120, spDef: 90, speed: 120 },
    comparisonStats: { hp: 95, attack: 135, defense: 80, spAtk: 110, spDef: 80, speed: 100 },
    strengthsEn: ["Fighting Types", "Grass Types"], strengthsZh: ["格斗系", "草系"],
    weaknessesEn: ["Ice (4x)", "Fairy"], weaknessesZh: ["冰(4倍)", "妖精"],
    coverageEn: ["Ground", "Fire", "Steel"], coverageZh: ["地面", "火", "钢"],
    partnersEn: ["Jirachi", "Magnezone"], partnersZh: ["基拉祈", "自爆磁怪"],
    matchupNetwork: [
        { opponentEn: "Mega Lucario", opponentZh: "超级路卡利欧", opponentTypes: ["Fighting", "Steel"], result: "win", descriptionEn: "Resists Fighting.", descriptionZh: "抵抗格斗。" },
        { opponentEn: "Mamoswine", opponentZh: "象牙猪", opponentTypes: ["Ice", "Ground"], result: "lose", descriptionEn: "4x Weak to Ice.", descriptionZh: "4倍弱冰。" }
    ],
    summaryEn: "Incredible physical bulk (130 Def) combined with 120 Speed. While it lacks Aerilate in Z-A, its raw stats and access to 'Double-Edge' and 'Earthquake' make it a formidable physical presence.",
    summaryZh: "惊人的物理耐久（130 防御）结合 120 的速度。虽然在 Z-A 失去了飞行皮肤特性，但其原始种族值配合“舍身冲撞”和“地震”，依然是极具压迫感的物理核心。"
});

// 10. Mega Mewtwo Y
addPreloaded({
    nameEn: "Mega Mewtwo Y", nameZh: "超级超梦Y", types: ["Psychic"], roleEn: "Special Glass Cannon", roleZh: "特攻玻璃大炮", tier: "S",
    stats: { hp: 106, attack: 150, defense: 70, spAtk: 194, spDef: 120, speed: 140 },
    comparisonStats: { hp: 106, attack: 110, defense: 90, spAtk: 154, spDef: 90, speed: 130 },
    strengthsEn: ["Fighting", "Poison"], strengthsZh: ["格斗", "毒"],
    weaknessesEn: ["Ghost", "Dark", "Bug"], weaknessesZh: ["幽灵", "恶", "虫"],
    coverageEn: ["Ice", "Fighting", "Fire"], coverageZh: ["冰", "格斗", "火"],
    partnersEn: ["Tapu Lele", "Indeedee"], partnersZh: ["卡璞·蝶蝶", "爱管侍"],
    matchupNetwork: [
        { opponentEn: "Mega Gengar", opponentZh: "超级耿鬼", opponentTypes: ["Ghost", "Poison"], result: "win", descriptionEn: "Faster and kills with Psystrike.", descriptionZh: "速度更快，精神击破确一。" },
        { opponentEn: "Yveltal", opponentZh: "伊菲尔塔尔", opponentTypes: ["Dark", "Flying"], result: "lose", descriptionEn: "Weak to Dark.", descriptionZh: "弱恶系。" }
    ],
    summaryEn: "With 194 Sp.Atk and 140 Speed, it has the highest offensive potential in the game. 'Psystrike' hits the opponent's Defense stat, allowing it to break special walls. Extremely fragile physically.",
    summaryZh: "拥有 194 特攻和 140 速度，具备全游戏最高的进攻上限。“精神击破”打击对手的物理防御，使其能突破特盾。物理耐久极低，非常脆弱。"
});

// 11. Mega Gardevoir
addPreloaded({
    nameEn: "Mega Gardevoir", nameZh: "超级沙奈朵", types: ["Psychic", "Fairy"], roleEn: "Special Breaker", roleZh: "特攻爆破", tier: "A",
    stats: { hp: 68, attack: 85, defense: 65, spAtk: 165, spDef: 135, speed: 100 },
    comparisonStats: { hp: 68, attack: 65, defense: 65, spAtk: 125, spDef: 115, speed: 80 },
    strengthsEn: ["Dragons", "Fighting"], strengthsZh: ["龙", "格斗"],
    weaknessesEn: ["Steel", "Ghost", "Poison"], weaknessesZh: ["钢", "幽灵", "毒"],
    coverageEn: ["Fire", "Electric", "Ground"], coverageZh: ["火", "电", "地面"],
    partnersEn: ["Landorus-T", "Heatran"], partnersZh: ["灵兽土云", "席多蓝恩"],
    matchupNetwork: [
        { opponentEn: "Zygarde (Complete)", opponentZh: "基格尔德(完全)", opponentTypes: ["Dragon", "Ground"], result: "win", descriptionEn: "Hyper Voice destroys it.", descriptionZh: "巨声直接摧毁。" },
        { opponentEn: "Mega Scizor", opponentZh: "超级巨钳螳螂", opponentTypes: ["Bug", "Steel"], result: "lose", descriptionEn: "Bullet Punch OHKOs.", descriptionZh: "子弹拳确一。" }
    ],
    summaryEn: "165 Sp.Atk is massive. Even without Pixilate, 'Moonblast' and 'Psychic' provide perfect dual STAB coverage. 'Mystical Fire' helps it deal with Steel types that would otherwise wall it.",
    summaryZh: "165 的特攻非常惊人。即便没有妖精皮肤，“月亮之力”和“精神强念”也提供了完美的双本系打击面。“魔法火焰”帮助它处理本来能封锁它的钢系宝可梦。"
});

// 12. Mega Blaziken
addPreloaded({
    nameEn: "Mega Blaziken", nameZh: "超级火焰鸡", types: ["Fire", "Fighting"], roleEn: "Mixed Sweeper", roleZh: "双刀推队", tier: "A+",
    stats: { hp: 80, attack: 160, defense: 80, spAtk: 130, spDef: 80, speed: 100 },
    comparisonStats: { hp: 80, attack: 120, defense: 70, spAtk: 110, spDef: 70, speed: 80 },
    strengthsEn: ["Steel", "Normal", "Dark"], strengthsZh: ["钢", "一般", "恶"],
    weaknessesEn: ["Water", "Ground", "Flying"], weaknessesZh: ["水", "地面", "飞行"],
    coverageEn: ["Electric", "Rock", "Flying"], coverageZh: ["电", "岩石", "飞行"],
    partnersEn: ["Bisharp", "Gyarados"], partnersZh: ["劈斩司令", "暴鲤龙"],
    matchupNetwork: [
        { opponentEn: "Ferrothorn", opponentZh: "坚果哑铃", opponentTypes: ["Grass", "Steel"], result: "win", descriptionEn: "4x Weak to Fire.", descriptionZh: "4倍弱火。" },
        { opponentEn: "Azumarill", opponentZh: "玛力露丽", opponentTypes: ["Water", "Fairy"], result: "lose", descriptionEn: "Weak to Water.", descriptionZh: "弱水。" }
    ],
    summaryEn: "Excellent mixed offensive stats (160/130). 'Flare Blitz' and 'Close Combat' are high-power STAB moves that destroy most walls. 100 Speed is decent for cooldown reduction.",
    summaryZh: "优秀的双刀种族值（160/130）。“闪焰冲锋”和“近身战”是高威力的本系招式，能粉碎大多数盾牌。100 的速度提供了尚可的技能冷却。"
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
        seasonRules = "WHITELIST: Kalos Dex + All Kalos Legends (Including Zygarde Complete). BANNED: None (Restricted Format).";
      } else {
        seasonRules = "Standard Kalos Dex rules.";
      }
      return `Generation Context: Pokémon Legends Z-A.
      CRITICAL MECHANICS:
      1. This is an Action RPG (like Legends Arceus but modern).
      2. SPEED STAT determines Skill Cooldown Reduction (CDR). Faster = More moves.
      3. Moves have AREA OF EFFECT (AOE). Earthquake, Surf, Hyper Voice are Top Tier.
      4. NO ABILITIES exist in this format (like PLA). DO NOT mention Abilities like Speed Boost, Parental Bond, Huge Power, etc.
      5. Mega Evolutions ARE allowed and central to the meta.
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
  // If we are already offline, or if it's Z-A Season 3 (which we have full static data for), prefer static data to save quota
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
    // Suppress error if it's 429 and just fallback
    return calculateMetaMatrix(FALLBACK_META_DATA, generation);
  }
};

export const analyzePokemon = async (pokemonName: string, generation: Generation, season: Regulation): Promise<PokemonAnalysis | null> => {
  const normalizedName = pokemonName.trim().toLowerCase();
  const cacheKey = `analysis-${generation}-${season}-${normalizedName}`;

  if (analysisCache[cacheKey]) return analysisCache[cacheKey];
  const localData = getLocalStorage<PokemonAnalysis>(cacheKey);
  if (localData) { analysisCache[cacheKey] = localData; return localData; }

  // CHECK PRELOADED DB FIRST
  // This is critical for saving quota. If we have the data, DO NOT CALL API.
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
    3. DO NOT MENTION ABILITIES (mechanic removed in Z-A). Focus on Stats, Typing, AOE, and Speed(CDR).
    
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

const generateMockAnalysis = (name: string): PokemonAnalysis => ({
    nameEn: name, nameZh: name, types: ["Normal"], roleEn: "Offline", roleZh: "离线", tier: "?",
    stats: { hp: 80, attack: 80, defense: 80, spAtk: 80, spDef: 80, speed: 80 },
    comparisonStats: { hp: 70, attack: 70, defense: 70, spAtk: 70, spDef: 70, speed: 70 },
    strengthsEn: ["Unknown"], strengthsZh: ["未知"], weaknessesEn: ["Fighting"], weaknessesZh: ["格斗"],
    coverageEn: ["Normal"], coverageZh: ["一般"], partnersEn: ["None"], partnersZh: ["无"], matchupNetwork: [],
    summaryEn: "Offline Mode. Analysis unavailable.", summaryZh: "离线模式。无法获取分析。"
});

// Improved Mock Team based on Z-A Meta (No Abilities)
const generateMockTeam = (prompt: string, generation?: Generation): TeamRecommendation => {
    const isZA = generation === 'legends-za';
    const noAbility = "N/A"; 
    return {
        archetype: isZA ? "Z-A Balanced Core (Offline)" : "Balanced Core (Offline)", 
        explanation: "Offline mode active. This is a balanced team template optimized for the selected format.",
        members: [
            { name: "Mega Charizard Y", item: isZA ? "Charizardite Y" : "Heavy-Duty Boots", ability: isZA ? noAbility : "Drought", nature: "Timid", moves: ["Heat Wave", "Solar Beam", "Roost", "Scorching Sands"], role: "Special Attacker" },
            { name: "Zygarde (Complete)", item: "Leftovers", ability: isZA ? noAbility : "Power Construct", nature: "Adamant", moves: ["Thousand Arrows", "Dragon Dance", "Rest", "Sleep Talk"], role: "Tank" },
            { name: "Aegislash", item: "Weakness Policy", ability: isZA ? noAbility : "Stance Change", nature: "Quiet", moves: ["King's Shield", "Shadow Ball", "Close Combat", "Shadow Sneak"], role: "Pivot" },
            { name: "Tapu Fini", item: "Choice Scarf", ability: isZA ? noAbility : "Misty Surge", nature: "Bold", moves: ["Moonblast", "Surf", "Defog", "Trick"], role: "Support" },
            { name: "Rillaboom", item: "Assault Vest", ability: isZA ? noAbility : "Grassy Surge", nature: "Adamant", moves: ["Grassy Glide", "Wood Hammer", "High Horsepower", "U-turn"], role: "Physical Attacker" },
            { name: "Incineroar", item: "Sitrus Berry", ability: isZA ? noAbility : "Intimidate", nature: "Careful", moves: ["Fake Out", "Parting Shot", "Flare Blitz", "Knock Off"], role: "Support" },
        ]
    };
};

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