
import React, { useState, useEffect } from 'react';
import { generateTeam } from '../services/geminiService';
import { TeamRecommendation, Language, Generation, Regulation } from '../types';
import { TRANSLATIONS } from '../utils/translations';

interface Props {
    lang: Language;
    generation: Generation;
    season: Regulation;
}

export const TeamBuilder: React.FC<Props> = ({ lang, generation, season }) => {
  const [prompt, setPrompt] = useState('');
  const [team, setTeam] = useState<TeamRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const t = TRANSLATIONS[lang];

  // Clear data when generation or season changes
  useEffect(() => {
    setTeam(null);
  }, [generation, season]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setTeam(null);
    const result = await generateTeam(prompt, lang, generation, season);
    setTeam(result);
    setLoading(false);
  };

  const suggestions = lang === 'en' ? [
    "Hyper Offense",
    "Trick Room",
    "Rain Team Balance",
    "Tailwind Support",
    "Stall Team"
  ] : [
    "极巨化进攻",
    "空间队",
    "雨天平衡队",
    "顺风辅助队",
    "受队"
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
       <div className="text-center mb-10">
        <h1 className="text-3xl md:text-5xl font-display font-bold text-slate-800 dark:text-white mb-4">{t.builderTitle}</h1>
        <p className="text-slate-600 dark:text-gray-400 max-w-2xl mx-auto">
          {t.builderDesc}
        </p>
      </div>

      <div className="mb-12 max-w-3xl mx-auto">
        <div className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t.builderPlaceholder}
            className="w-full bg-white dark:bg-za-panel border-2 border-gray-200 dark:border-white/20 rounded-full px-8 py-4 text-lg text-slate-800 dark:text-white focus:outline-none focus:border-za-magenta transition-all shadow-lg focus:shadow-za-magenta/20"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 bg-za-magenta hover:bg-fuchsia-400 text-white px-8 rounded-full font-bold font-display transition-colors disabled:opacity-50 shadow-md"
          >
            {loading ? t.buildingBtn : t.generateBtn}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {suggestions.map(s => (
            <button 
              key={s} 
              onClick={() => setPrompt(s)}
              className="text-xs bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 px-3 py-1 rounded-full border border-gray-200 dark:border-white/5 transition-colors shadow-sm"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {team && (
        <div className="animate-fade-in space-y-8">
          <div className="bg-white dark:bg-za-panel/50 border-l-4 border-za-magenta p-6 rounded-r-lg shadow-md">
            <h2 className="text-2xl font-display text-slate-800 dark:text-white mb-2">{team.archetype}</h2>
            <p className="text-slate-600 dark:text-gray-300 italic">{team.explanation}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {team.members.map((member, idx) => (
              <div key={idx} className="bg-white dark:bg-za-panel border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden hover:border-za-cyan/50 transition-colors group shadow-lg">
                <div className="bg-gray-50 dark:bg-black/40 p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                  <span className="font-display font-bold text-xl text-slate-800 dark:text-white">{member.name}</span>
                   <span className="text-xs font-mono text-za-cyan uppercase tracking-wider">{member.role}</span>
                </div>
                
                <div className="p-5 space-y-4">
                   <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="block text-slate-400 dark:text-gray-500 text-xs uppercase">{t.item}</span>
                        <span className="text-slate-700 dark:text-gray-200">{member.item}</span>
                      </div>
                      
                      {/* Hide Ability for Z-A Generation */}
                      {generation !== 'legends-za' && (
                        <div>
                          <span className="block text-slate-400 dark:text-gray-500 text-xs uppercase">{t.ability}</span>
                          <span className="text-slate-700 dark:text-gray-200">{member.ability}</span>
                        </div>
                      )}
                      
                      <div className="col-span-2">
                        <span className="block text-slate-400 dark:text-gray-500 text-xs uppercase">{t.nature}</span>
                        <span className="text-slate-700 dark:text-gray-200">{member.nature}</span>
                      </div>
                   </div>

                   <div>
                     <span className="block text-slate-400 dark:text-gray-500 text-xs uppercase mb-2">{t.moveset}</span>
                     <div className="grid grid-cols-1 gap-1">
                       {member.moves.map((move, mIdx) => (
                         <div key={mIdx} className="bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded text-sm text-slate-600 dark:text-gray-300 border border-gray-200 dark:border-white/5 group-hover:border-za-cyan/20 transition-colors">
                           {move}
                         </div>
                       ))}
                     </div>
                   </div>
                </div>
                {/* Decorative bar */}
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-za-cyan to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
