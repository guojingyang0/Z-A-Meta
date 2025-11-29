import { PokemonType } from './types';

export const TYPE_COLORS: Record<PokemonType, string> = {
  [PokemonType.Normal]: '#A8A77A',
  [PokemonType.Fire]: '#EE8130',
  [PokemonType.Water]: '#6390F0',
  [PokemonType.Electric]: '#F7D02C',
  [PokemonType.Grass]: '#7AC74C',
  [PokemonType.Ice]: '#96D9D6',
  [PokemonType.Fighting]: '#C22E28',
  [PokemonType.Poison]: '#A33EA1',
  [PokemonType.Ground]: '#E2BF65',
  [PokemonType.Flying]: '#A98FF3',
  [PokemonType.Psychic]: '#F95587',
  [PokemonType.Bug]: '#A6B91A',
  [PokemonType.Rock]: '#B6A136',
  [PokemonType.Ghost]: '#735797',
  [PokemonType.Dragon]: '#6F35FC',
  [PokemonType.Steel]: '#B7B7CE',
  [PokemonType.Dark]: '#705746',
  [PokemonType.Fairy]: '#D685AD',
  [PokemonType.None]: '#334155'
};

export const TYPE_NAMES_ZH: Record<PokemonType, string> = {
  [PokemonType.Normal]: '一般',
  [PokemonType.Fire]: '火',
  [PokemonType.Water]: '水',
  [PokemonType.Electric]: '电',
  [PokemonType.Grass]: '草',
  [PokemonType.Ice]: '冰',
  [PokemonType.Fighting]: '格斗',
  [PokemonType.Poison]: '毒',
  [PokemonType.Ground]: '地面',
  [PokemonType.Flying]: '飞行',
  [PokemonType.Psychic]: '超能力',
  [PokemonType.Bug]: '虫',
  [PokemonType.Rock]: '岩石',
  [PokemonType.Ghost]: '幽灵',
  [PokemonType.Dragon]: '龙',
  [PokemonType.Steel]: '钢',
  [PokemonType.Dark]: '恶',
  [PokemonType.Fairy]: '妖精',
  [PokemonType.None]: '无'
};

// Simplified Type Chart Logic (Attacker -> Defender -> Multiplier)
// 0 = No Effect, 0.5 = Not Very Effective, 1 = Neutral, 2 = Super Effective
const typeChartData: Record<string, Record<string, number>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Steel: 0.5, Dark: 2 }
};

export const getEffectiveness = (attacker: PokemonType, defender: PokemonType): number => {
  if (attacker === PokemonType.None || defender === PokemonType.None) return 1;
  
  const attackerData = typeChartData[attacker];
  if (!attackerData) return 1;

  const modifier = attackerData[defender];
  return modifier !== undefined ? modifier : 1;
};

export const getAllTypes = () => Object.values(PokemonType).filter(t => t !== PokemonType.None);