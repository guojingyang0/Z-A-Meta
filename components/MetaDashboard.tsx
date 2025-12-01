import React, { useEffect, useState, useCallback } from 'react';
import { getMetaAnalysis } from '../services/geminiService';
import { getAllAnalysis } from '../services/storageService';
import { MetaPokemonData, Language, Generation, Regulation, PokemonAnalysis } from '../types';
import { TypeBadge } from './TypeBadge';
import { TRANSLATIONS } from '../utils/translations';
import { getPokemonSpriteUrl } from '../utils/helpers';
import { TeamSynergy } from './TeamSynergy';

interface Props {
    lang: Language;
    generation: Generation;
    season: Regulation;
    onAnalyze: (name: string) => void;
    cachedData: { key: string, data: MetaPokemonData[] } | null;
    onUpdateCache: (key: string, data: MetaPokemonData[]) => void;
}

export const MetaDashboard: React.FC<Props> = ({ 
    lang, generation, season, onAnalyze, 
    cachedData, onUpdateCache 
}) => {
  const [loading, setLoading] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<PokemonAnalysis[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0); 
  const [viewMode, setViewMode] = useState<'pokemon' | 'team'>('pokemon');
  
  const ITEMS_PER_PAGE = 8;
  const t = TRANSLATIONS[lang];
  
  const currentKey = `${generation}-${season}`;

  const fetchMeta = useCallback(async () => {
    if (cachedData && cachedData.key === currentKey && cachedData.data.length > 0 && retryCount === 0) {
        setLoading(false);
        return;
    }
    setLoading(true);
    setCurrentPage(1);
    if (retryCount > 0) await new Promise(r => setTimeout(r, 500));
    const result = await getMetaAnalysis(generation, season);
    onUpdateCache(currentKey, result);
    setLoading(false);
  }, [generation, season, cachedData, currentKey, onUpdateCache, retryCount]);

  useEffect(() => {
    if (viewMode === 'pokemon') {
        fetchMeta();
    }
  }, [fetchMeta, viewMode]);

  // Fetch history when modal opens
  useEffect(() => {
      if (showHistory) {
          getAllAnalysis().then(list => setHistoryList(list.reverse())); // Show newest first usually, or just list
      }
  }, [showHistory]);

  const getGenLabel = () => {
    switch(generation) {
        case 'legends-za': return t.envLegendsZA;
        case 'gen9': return t.envGen9;
        case 'gen8': return t.envGen8;
        case 'gen6': return t.envGen6;
        default: return '';
    }
  };

  const displayData = (cachedData && cachedData.key === currentKey) ? cachedData.data : [];
  const totalPages = Math.ceil(displayData.length / ITEMS_PER_PAGE);
  const currentData = displayData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-4 mb-2">
             <h1 className="text-3xl md:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-za-cyan to-za-magenta">
              {t.appTitle}
            </h1>
            <div className="flex gap-1">
                <button 
                onClick={() => setShowMethodology(!showMethodology)}
                className="text-za-cyan hover:text-za-magenta transition-colors p-2 rounded hover:bg-white/5"
                title={t.methodologyBtn}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </button>
                <button 
                onClick={() => setShowHistory(true)}
                className="text-za-magenta hover:text-za-cyan transition-colors p-2 rounded hover:bg-white/5"
                title={t.historyTitle}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
            </div>
           </div>
           
           <div className="flex flex-col gap-1 border-l-2 border-za-cyan pl-3">
             <p className="text-slate-700 dark:text-gray-200 text-sm md:text-base font-sans font-bold">
                {getGenLabel()}
             </p>
             {generation === 'legends-za' && (
                 <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">
                    {t.mechanicNote}
                 </span>
             )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-white/5 rounded-full border border-gray-200 dark:border-white/10">
          <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`}></span>
          <span className="text-xs text-slate-500 dark:text-gray-400 font-mono uppercase tracking-wide">
            {loading ? t.analyzingBtn : t.liveConnection}
          </span>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-za-panel border border-za-magenta/50 w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
                  <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-za-dark/5 dark:bg-black/20">
                      <h3 className="text-xl font-display font-bold text-za-magenta">{t.historyTitle}</h3>
                      <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                  </div>
                  <div className="overflow-y-auto p-4 flex-1">
                      {historyList.length === 0 ? (
                          <div className="text-center text-gray-500 py-10">{t.noHistory}</div>
                      ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {historyList.map((item, idx) => (
                                  <div 
                                    key={idx} 
                                    onClick={() => {
                                        onAnalyze(item.nameEn);
                                        setShowHistory(false);
                                    }}
                                    className="cursor-pointer bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 flex items-center gap-3 hover:border-za-magenta hover:bg-za-magenta/5 transition-all"
                                  >
                                      <img 
                                        src={getPokemonSpriteUrl(item.nameEn)} 
                                        className="w-12 h-12 object-contain" 
                                        alt={item.nameEn} 
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`;
                                        }}
                                      />
                                      <div className="overflow-hidden">
                                          <div className="font-bold text-slate-800 dark:text-white truncate">{lang === 'zh' ? item.nameZh : item.nameEn}</div>
                                          <div className="text-xs text-za-magenta font-mono">{item.tier} Tier</div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {showMethodology && (
        <div className="mb-8 bg-za-panel-light dark:bg-za-panel border border-za-cyan/30 rounded-xl p-6 animate-fade-in shadow-[0_0_15px_rgba(0,243,255,0.1)] relative">
            <button 
              onClick={() => setShowMethodology(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h3 className="text-xl font-display font-bold text-za-cyan mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              {t.methodologyTitle}
            </h3>
            <p className="text-slate-600 dark:text-gray-300 mb-4">{t.methodologyDesc}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-gray-300 ml-2">
              <li>{t.methodologyPoint1}</li>
              <li>{t.methodologyPoint2}</li>
              <li>{t.methodologyPoint3}</li>
              {generation === 'legends-za' && <li className="text-za-cyan">{t.methodologyPoint4}</li>}
            </ul>
        </div>
      )}

      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-white/10">
          <button 
            onClick={() => setViewMode('pokemon')}
            className={`pb-2 px-4 font-display font-bold tracking-wider transition-all ${
                viewMode === 'pokemon' 
                ? 'text-za-cyan border-b-2 border-za-cyan' 
                : 'text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300'
            }`}
          >
              {t.analyzer} (Pokémon)
          </button>
          <button 
            onClick={() => setViewMode('team')}
            className={`pb-2 px-4 font-display font-bold tracking-wider transition-all ${
                viewMode === 'team' 
                ? 'text-za-magenta border-b-2 border-za-magenta' 
                : 'text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300'
            }`}
          >
              {t.synergyTitle} (Squads)
          </button>
      </div>

      {viewMode === 'team' ? (
          <TeamSynergy lang={lang} generation={generation} season={season} />
      ) : (
          loading ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
            <div className="relative">
                <div className="w-20 h-20 border-4 border-za-cyan/30 border-t-za-cyan rounded-full animate-spin"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-za-cyan/10 rounded-full blur-lg animate-pulse"></div>
            </div>
            <p className="text-za-cyan font-mono animate-pulse tracking-widest">{t.connecting}</p>
            </div>
        ) : (
            <>
            <div className="grid grid-cols-1 gap-6">
            {currentData.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-500 gap-4">
                    <span className="text-lg font-bold">{t.failedMeta}</span>
                    <button 
                    onClick={() => setRetryCount(prev => prev + 1)}
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow-md transition-colors"
                    >
                    Retry Connection
                    </button>
                </div>
            ) : (
                currentData.map((mon, index) => {
                const name = lang === 'zh' ? mon.nameZh : mon.nameEn;
                const analysis = lang === 'zh' ? mon.analysisZh : mon.analysisEn;
                const keyMoves = lang === 'zh' ? mon.keyMovesZh : mon.keyMovesEn;
                const spriteUrl = getPokemonSpriteUrl(mon.nameEn, mon.id);

                return (
                    <div 
                        key={`${mon.id}-${index}`} 
                        onClick={() => onAnalyze(mon.nameEn)}
                        className="group relative bg-white dark:bg-za-panel border border-gray-200 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-xl hover:border-za-cyan/30 dark:hover:border-za-cyan/30 transition-all duration-300 overflow-hidden animate-fade-in-up cursor-pointer" 
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="absolute top-0 left-0 bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-br-2xl border-b border-r border-gray-200 dark:border-white/5 font-display font-bold text-xl text-slate-400 dark:text-gray-500 group-hover:text-za-cyan group-hover:bg-za-cyan/10 transition-colors z-10">
                            #{mon.rank}
                        </div>
                        <div className="absolute top-4 right-4 text-xs text-za-cyan opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            {t.analyzeBtn} ›
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 mt-6 md:mt-0">
                            <div className="flex-shrink-0 flex flex-col items-center justify-center md:w-48 relative">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-za-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full blur-2xl"></div>
                                <img 
                                    src={spriteUrl}
                                    alt={mon.nameEn}
                                    className="w-32 h-32 md:w-40 md:h-40 object-contain z-10 drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                                    onError={(e) => {
                                        const fallback = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mon.id}.png`;
                                        if ((e.target as HTMLImageElement).src !== fallback) {
                                            (e.target as HTMLImageElement).src = fallback;
                                        }
                                    }}
                                />
                                <div className="flex gap-2 mt-2 justify-center flex-wrap">
                                    {(mon.types || []).map(t => <TypeBadge key={t} type={t} size="sm" lang={lang} />)}
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col justify-center">
                                <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-2">
                                    <div>
                                        <h2 className="text-2xl md:text-3xl font-bold font-display text-slate-800 dark:text-white group-hover:text-za-cyan transition-colors">
                                            {name}
                                        </h2>
                                        <div className="text-xs font-mono text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                                            BST: <span className="text-slate-600 dark:text-gray-300">{mon.baseStatsTotal}</span> | ID: #{mon.id}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-6 bg-slate-50 dark:bg-black/20 px-4 py-2 rounded-lg">
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-bold">{t.winRate}</div>
                                            <div className="text-xl font-display font-bold text-green-500 dark:text-green-400">{mon.winRate}%</div>
                                        </div>
                                        <div className="w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-bold">{t.usageRate}</div>
                                            <div className="text-xl font-display font-bold text-blue-500 dark:text-blue-400">{mon.usageRate}%</div>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-slate-600 dark:text-gray-300 text-sm leading-relaxed mb-4 border-l-2 border-za-cyan/30 pl-4">
                                    {analysis}
                                </p>

                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase mb-2">{t.keyMoves}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {(keyMoves || []).map(move => (
                                            <span key={move} className="px-3 py-1 bg-slate-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded text-xs text-slate-600 dark:text-gray-300 font-medium">
                                                {move}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="absolute -bottom-6 -right-4 text-[120px] font-display font-black text-slate-900/[0.03] dark:text-white/[0.03] pointer-events-none select-none z-0">
                            {mon.rank}
                        </div>
                    </div>
                );
                })
            )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8 font-display">
                    <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white dark:bg-white/5 hover:bg-za-cyan/10 disabled:opacity-30 rounded border border-gray-200 dark:border-white/10 text-slate-700 dark:text-white transition-colors"
                    >
                        &lt; {t.prevPage}
                    </button>
                    <span className="text-slate-500 dark:text-gray-400 font-mono">
                        {currentPage} / {totalPages}
                    </span>
                    <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white dark:bg-white/5 hover:bg-za-cyan/10 disabled:opacity-30 rounded border border-gray-200 dark:border-white/10 text-slate-700 dark:text-white transition-colors"
                    >
                        {t.nextPage} &gt;
                    </button>
                </div>
            )}
            </>
        )
      )}
    </div>
  );
};