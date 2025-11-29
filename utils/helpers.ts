
// Utility to get the correct sprite URL from PokeAPI or similar sources
// Handles Edge cases like Mega Charizard X/Y, Regional Forms, etc.

export const getPokemonSpriteUrl = (name: string, id?: number): string => {
  if (!name) return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';

  // 1. Lowercase
  let lower = name.toLowerCase();

  // 2. Handle specific form keywords before stripping chars
  let suffix = '';
  
  // Specific handling for Mega X/Y to prevent 'charizardy-megay' issues
  // We strip the phrase from the base name immediately to leave the clean species name
  if (lower.includes('mega x')) {
    suffix = '-megax';
    lower = lower.replace('mega x', ''); 
  }
  else if (lower.includes('mega y')) {
    suffix = '-megay';
    lower = lower.replace('mega y', '');
  }
  else if (lower.includes('mega') && !lower.includes('meganium')) suffix = '-mega'; // prevent meganium false positive
  else if (lower.includes('gmax') || lower.includes('gigantamax')) suffix = '-gmax';
  else if (lower.includes('alola')) suffix = '-alola';
  else if (lower.includes('galar')) suffix = '-galar';
  else if (lower.includes('hisui')) suffix = '-hisui';
  else if (lower.includes('paldea')) suffix = '-paldea';
  else if (lower.includes('complete')) suffix = '-complete'; // Zygarde
  else if (lower.includes('therian')) suffix = '-therian';
  else if (lower.includes('origin')) suffix = '-origin'; // Giratina/Palkia/Dialga
  else if (lower.includes('10%')) suffix = '-10';
  else if (lower.includes('rapid strike')) suffix = '-rs'; // Urshifu
  
  // 3. Clean the base name
  // Remove form words from the base name to get the species
  let species = lower
    .replace(/\(.*\)/g, '') // remove parens content
    .replace('mega', '')
    .replace('gmax', '')
    .replace('gigantamax', '')
    .replace('alolan', '')
    .replace('galarian', '')
    .replace('hisuian', '')
    .replace('paldean', '')
    .replace('complete', '')
    .replace('forme', '')
    .replace('form', '')
    .replace('therian', '')
    .replace('origin', '')
    .replace('10%', '')
    .replace('rapid strike', '')
    .replace('single strike', '')
    .trim();

  // 4. Handle Paradox / Tapus / Ruins (Remove spaces/dashes for Showdown format)
  // Showdown naming convention: 'fluttermane', 'tapukoko', 'wochien', 'chiyu'
  // But 'charizard' is 'charizard'.
  
  // Strip all non-alphanumeric characters for the species name
  // This converts "Tapu Koko" -> "tapukoko", "Flutter Mane" -> "fluttermane", "Chi-Yu" -> "chiyu"
  // Also handles "Mr. Mime" -> "mrmime"
  species = species.replace(/[^a-z0-9]/g, '');

  let finalName = species + suffix;

  // Edge Case overrides map for things that don't fit the generic logic
  const overrides: Record<string, string> = {
    'zygarde-complete': 'zygarde-complete',
    'zygarde-10': 'zygarde-10',
    'mimikyu': 'mimikyu', // disguised is default
    'aegislash': 'aegislash', // shield is default
    'basculegion': 'basculegion', // male is default
    'urshifu': 'urshifu', // single strike default
    'urshifurapidstrike': 'urshifu-rs', // catch if suffix logic missed
    'typenull': 'typenull',
    'jangmoo': 'jangmo-o', 
  };

  if (overrides[finalName]) {
      finalName = overrides[finalName];
  }

  // Double check some common errors
  if (finalName === 'charizard-mega') finalName = 'charizard-megax'; // Default to X if unspecified? Or maybe standard mega
  
  return `https://play.pokemonshowdown.com/sprites/ani/${finalName}.gif`;
};

// Helper to determine if a name implies Mega X or Mega Y
export const isSplitMega = (name: string): boolean => {
  const n = name.toLowerCase();
  return n.includes('mega x') || n.includes('mega y') || n.includes('mega-x') || n.includes('mega-y');
};
