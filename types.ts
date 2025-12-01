
export enum PokemonType {
  Normal = 'Normal',
  Fire = 'Fire',
  Water = 'Water',
  Electric = 'Electric',
  Grass = 'Grass',
  Ice = 'Ice',
  Fighting = 'Fighting',
  Poison = 'Poison',
  Ground = 'Ground',
  Flying = 'Flying',
  Psychic = 'Psychic',
  Bug = 'Bug',
  Rock = 'Rock',
  Ghost = 'Ghost',
  Dragon = 'Dragon',
  Steel = 'Steel',
  Dark = 'Dark',
  Fairy = 'Fairy',
  None = 'None'
}

export type AIProvider = 'gemini' | 'openai';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface TypeMatchup {
  type: PokemonType;
  multiplier: number;
}

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface MatchupNode {
  opponentEn: string;
  opponentZh: string;
  // New: We need the opponent's types to calculate inter-node relationships
  opponentTypes: string[]; 
  result: 'win' | 'lose' | 'check';
  descriptionEn: string;
  descriptionZh: string;
}

export interface PokemonAnalysis {
  nameEn: string;
  nameZh: string;
  types: string[];
  roleEn: string;
  roleZh: string;
  tier: string;
  stats: PokemonStats;
  // Stats for comparison (e.g. Base form or Pre-evolution)
  comparisonStats?: PokemonStats;
  comparisonLabel?: string; 
  
  relatedForms?: string[]; // e.g. ["Mega Charizard X", "Mega Charizard Y"]

  strengthsEn: string[];
  strengthsZh: string[];
  weaknessesEn: string[];
  weaknessesZh: string[];
  
  // New: Coverage types (types of attacking moves usually carried)
  coverageEn: string[];
  coverageZh: string[];

  // New: Full viable movepool
  movepoolEn: string[];
  movepoolZh: string[];

  partnersEn: string[];
  partnersZh: string[];
  
  matchupNetwork?: MatchupNode[];
  
  summaryEn: string;
  summaryZh: string;
}

export interface TeamMember {
  name: string;
  item: string;
  ability: string;
  nature: string;
  moves: string[];
  role: string;
}

export interface TeamRecommendation {
  archetype: string;
  explanation: string;
  members: TeamMember[];
}

export interface TeamSynergyAnalysis {
  teamName: string;
  synergyScore: number; // 0-100 (Overall Cohesion)
  
  // New Metrics for "Squad Meta Analysis"
  winRate: number; // 0-100 (Projected against current meta)
  usageRate: number; // 0-100 (Estimated popularity)
  defensiveScore: number; // 0-100 (Joint Defense / Type Coverage)
  offensiveScore: number; // 0-100 (Joint Attack / Combo Potential)

  roleDistributionEn: string;
  roleDistributionZh: string;
  
  // Combo chains (Action RPG specific)
  combosEn: string[];
  combosZh: string[];
  
  strengthsEn: string[];
  strengthsZh: string[];
  
  majorWeaknessesEn: string[];
  majorWeaknessesZh: string[];
  
  overallAnalysisEn: string;
  overallAnalysisZh: string;
}

// New Interface for Ranked Teams List
export interface MetaTeamData {
  rank: number;
  nameEn: string; // e.g. "The Big Three"
  nameZh: string;
  members: string[]; // List of 3 Pokemon names (English)
  membersZh: string[]; // List of 3 Pokemon names (Chinese)
  
  winRate: number;
  usageRate: number;
  synergyScore: number;

  coreStrategyEn: string;
  coreStrategyZh: string;
  
  analysisEn: string;
  analysisZh: string;
}

export interface MetaPokemonData {
  rank: number;
  nameEn: string; 
  nameZh: string;
  id: number; // National Dex ID
  types: string[]; // English keys for mapping
  
  // Calculated fields
  winRate: number; // 0-100 (Calculated via Matrix)
  usageRate: number; // 0-100 (Renamed logic to Dominance Score)
  
  keyMovesEn: string[];
  keyMovesZh: string[];
  
  // New: Data required for Math Model
  stats: PokemonStats;
  isAOE: boolean; // Does it have high-tier AOE (Earthquake, etc)
  hasCrowdControl: boolean; // Stun/Freeze/Sleep capabilities
  
  baseStatsTotal: number;
  analysisEn: string;
  analysisZh: string;
}

export type ViewState = 'meta' | 'analyze' | 'team' | 'synergy' | 'calculator';

export type Language = 'en' | 'zh';
export type Theme = 'dark' | 'light';

export type Generation = 'legends-za' | 'gen9' | 'gen8' | 'gen6';

// Season/Regulation Context
export type Regulation = 'season1' | 'season2' | 'season3' | 'standard';

export const GENERATIONS: { id: Generation; labelEn: string; labelZh: string }[] = [
  { id: 'legends-za', labelEn: 'Legends Z-A', labelZh: '传说 Z-A' },
  { id: 'gen9', labelEn: 'Gen 9 (S/V)', labelZh: '第九世代 (朱/紫)' },
  { id: 'gen8', labelEn: 'Gen 8 (Sw/Sh)', labelZh: '第八世代 (剑/盾)' },
  { id: 'gen6', labelEn: 'Gen 6 (X/Y)', labelZh: '第六世代 (X/Y)' },
];

export const SEASONS: { id: Regulation; labelEn: string; labelZh: string }[] = [
  { id: 'season1', labelEn: 'Season 1 (Kalos Native)', labelZh: '第一赛季 (卡洛斯原生)' },
  { id: 'season2', labelEn: 'Season 2 (Xerneas/Yveltal)', labelZh: '第二赛季 (哲尔尼亚斯/伊菲尔塔尔)' },
  { id: 'season3', labelEn: 'Season 3 (Zygarde Complete)', labelZh: '第三赛季 (完全体基格尔德)' },
];
