
import React, { useState, useEffect } from 'react';
import { getMetaTeams } from '../services/geminiService';
import { MetaTeamData, Language, Generation, Regulation } from '../types';
import { TRANSLATIONS } from '../utils/translations';
import { getPokemonSpriteUrl } from '../utils/helpers';

interface Props {
    lang: Language;
    generation: Generation;
    season: Regulation;
}

export const TeamSynergy: React.FC<Props> = ({ lang, generation, season }) => {
  const [teams, setTeams] = useState<MetaTeamData[]>([]);
  const [loading, setLoading] = useState(false);
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      // Fetch ranked teams instead of single analysis
      const result = await getMetaTeams(generation, season);
      setTeams(result);
      setLoading(false);
    };

    fetchTeams();
  }, [generation, season]);

  const getScoreColor = (score: number) => {
      if (score >= 90) return 'text-za-magenta drop-shadow-[0_0_10px_rgba(255,0,255,0.5)]';
      if (score >= 80) return 'text-za-cyan drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]';
      if (score >= 60) return 'text-yellow-400';
      return 'text-red-500';
  };

  return (
    <div className="w-full">
      {/* Header removed as it is now embedded in MetaDashboard tabs */}
      
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
          <div className="relative">
             <div className="w-20 h-20 border-4 border-za-magenta/30 border-t-za-magenta rounded-full animate-spin"></div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-za-magenta/10 rounded-full blur-lg animate-pulse"></div>
          </div>
          <p className="text-za-magenta font-mono animate-pulse tracking-widest">{t.analyzingBtn}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 animate-fade-in-up">
           {teams.map((team, index) => (
             <div 
                key={index}
                className="group relative bg-white dark:bg-za-panel border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-md hover:shadow-[0_0_30px_rgba(0,243,255,0.1)] hover:border-za-cyan/30 transition-all duration-300 overflow-hidden"
             >
                {/* Background Gradient Effect */}
                <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-za-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                {/* Rank Badge */}
                <div className="absolute -top-3 -left-3 w-16 h-16 bg-za-dark border border-gray-700 rounded-full flex items-center justify-center z-10 shadow-lg">
                    <span className="font-display font-bold text-2xl text-white">#{team.rank}</span>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 relative z-0 pl-4 md:pl-8 pt-4">
                    {/* Visual Core Display */}
                    <div className="flex-shrink-0 flex items-center justify-center">
                        <div className="flex -space-x-6 hover:space-x-2 transition-all duration-300">
                            {team.members.map((member, i) => (
                                <div key={i} className="relative w-24 h-24 md:w-32 md:h-32 transition-transform hover:scale-110 hover:z-20 z-0">
                                    <img 
                                        src={getPokemonSpriteUrl(member)} 
                                        alt={member}
                                        className="w-full h-full object-contain drop-shadow-lg"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`;
                                        }}
                                    />
                                    <div className="absolute bottom-0 left-0 w-full text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[10px] bg-black/70 text-white px-1 rounded truncate block max-w-full">
                                            {/* Show Localized Name on Hover */}
                                            {lang === 'zh' && team.membersZh?.[i] ? team.membersZh[i] : member}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Data & Analysis */}
                    <div className="flex-1">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                            <div>
                                <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-white group-hover:text-za-cyan transition-colors">
                                    {lang === 'zh' ? team.nameZh : team.nameEn}
                                </h2>
                                <div className="text-sm font-bold text-za-magenta mt-1 uppercase tracking-wide">
                                    {lang === 'zh' ? team.coreStrategyZh : team.coreStrategyEn}
                                </div>
                            </div>

                            {/* Metrics Badge */}
                            <div className="flex gap-4 mt-4 md:mt-0 bg-gray-50 dark:bg-black/20 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                                <div className="text-center px-2">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold">{t.score}</div>
                                    <div className={`text-xl font-display font-bold ${getScoreColor(team.synergyScore)}`}>
                                        {team.synergyScore}
                                    </div>
                                </div>
                                <div className="w-px bg-gray-200 dark:bg-white/10"></div>
                                <div className="text-center px-2">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold">{t.winRate}</div>
                                    <div className="text-xl font-display font-bold text-green-500">{team.winRate}%</div>
                                </div>
                                <div className="w-px bg-gray-200 dark:bg-white/10"></div>
                                <div className="text-center px-2">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold">{t.usageRate}</div>
                                    <div className="text-xl font-display font-bold text-blue-500">{team.usageRate}%</div>
                                </div>
                            </div>
                        </div>

                        <p className="text-slate-600 dark:text-gray-300 text-sm leading-relaxed border-l-2 border-za-cyan/30 pl-4 mb-4">
                            {lang === 'zh' ? team.analysisZh : team.analysisEn}
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                            {team.members.map((m, i) => (
                                <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-white/5 rounded text-xs text-slate-500 dark:text-gray-400 font-mono">
                                    {lang === 'zh' && team.membersZh?.[i] ? team.membersZh[i] : m}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
};
