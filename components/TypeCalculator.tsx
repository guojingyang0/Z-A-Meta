import React, { useState } from 'react';
import { PokemonType, TypeMatchup, Language } from '../types';
import { getAllTypes, getEffectiveness } from '../constants';
import { TypeBadge } from './TypeBadge';
import { TRANSLATIONS } from '../utils/translations';

interface Props {
    lang: Language;
}

export const TypeCalculator: React.FC<Props> = ({ lang }) => {
  const [defType1, setDefType1] = useState<PokemonType>(PokemonType.Normal);
  const [defType2, setDefType2] = useState<PokemonType>(PokemonType.None);
  const t = TRANSLATIONS[lang];

  const calculateWeaknesses = () => {
    const allTypes = getAllTypes();
    const matchups: TypeMatchup[] = [];

    allTypes.forEach(attacker => {
      const mult1 = getEffectiveness(attacker, defType1);
      const mult2 = defType2 !== PokemonType.None ? getEffectiveness(attacker, defType2) : 1;
      const total = mult1 * mult2;

      if (total !== 1) {
        matchups.push({ type: attacker, multiplier: total });
      }
    });

    return matchups.sort((a, b) => b.multiplier - a.multiplier);
  };

  const matchups = calculateWeaknesses();
  const weaknesses = matchups.filter(m => m.multiplier > 1);
  const resistances = matchups.filter(m => m.multiplier < 1);

  return (
    <div className="space-y-6 animate-fade-in p-4">
      <div className="bg-white dark:bg-za-panel/50 backdrop-blur-md rounded-xl p-6 border border-gray-200 dark:border-white/10 shadow-lg">
        <h2 className="text-2xl font-display text-za-cyan mb-6">{t.defAnalysis}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <label className="block text-slate-500 dark:text-gray-400 mb-2 font-display text-sm">{t.primaryType}</label>
            <div className="flex flex-wrap gap-2">
              {getAllTypes().map(type => (
                <TypeBadge 
                  key={type} 
                  type={type} 
                  size="sm" 
                  selected={defType1 === type}
                  onClick={() => setDefType1(type)}
                  lang={lang}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-slate-500 dark:text-gray-400 mb-2 font-display text-sm">{t.secondaryType}</label>
            <div className="flex flex-wrap gap-2">
              <TypeBadge 
                type={PokemonType.None} 
                size="sm" 
                selected={defType2 === PokemonType.None}
                onClick={() => setDefType2(PokemonType.None)}
                className="bg-gray-400 dark:bg-gray-600"
                lang={lang}
              />
              {getAllTypes().map(type => (
                <TypeBadge 
                  key={type} 
                  type={type} 
                  size="sm" 
                  selected={defType2 === type}
                  onClick={() => type !== defType1 && setDefType2(type)}
                  className={type === defType1 ? 'opacity-25 cursor-not-allowed' : ''}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weaknesses */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 rounded-lg p-4">
            <h3 className="text-red-500 dark:text-red-400 font-display mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              {t.weaknesses}
            </h3>
            {weaknesses.length === 0 ? (
              <p className="text-slate-500 dark:text-gray-500 italic">{t.noWeakness}</p>
            ) : (
              <div className="space-y-2">
                {weaknesses.map(m => (
                  <div key={m.type} className="flex justify-between items-center bg-white dark:bg-black/30 p-2 rounded shadow-sm">
                    <TypeBadge type={m.type} size="sm" lang={lang} />
                    <span className="font-mono text-red-500 dark:text-red-300 font-bold">{m.multiplier}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resistances */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/20 rounded-lg p-4">
            <h3 className="text-green-600 dark:text-green-400 font-display mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              {t.resistances}
            </h3>
            {resistances.length === 0 ? (
              <p className="text-slate-500 dark:text-gray-500 italic">{t.noResistance}</p>
            ) : (
              <div className="space-y-2">
                {resistances.map(m => (
                  <div key={m.type} className="flex justify-between items-center bg-white dark:bg-black/30 p-2 rounded shadow-sm">
                    <TypeBadge type={m.type} size="sm" lang={lang} />
                    <span className="font-mono text-green-600 dark:text-green-300 font-bold">{m.multiplier}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};