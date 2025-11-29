
import React, { ReactNode } from 'react';
import { ViewState, Language, Theme, Generation, GENERATIONS, Regulation, SEASONS } from '../types';
import { TRANSLATIONS } from '../utils/translations';

interface Props {
  children: ReactNode;
  currentView: ViewState;
  setView: (view: ViewState) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
  generation: Generation;
  setGeneration: (gen: Generation) => void;
  season: Regulation;
  setSeason: (season: Regulation) => void;
}

export const Layout: React.FC<Props> = ({ 
  children, currentView, setView, 
  lang, setLang, theme, toggleTheme,
  generation, setGeneration,
  season, setSeason
}) => {
  const t = TRANSLATIONS[lang];

  const navItems: { id: ViewState; label: string; icon: string }[] = [
    { id: 'meta', label: t.meta, icon: 'M' },
    { id: 'analyze', label: t.analyzer, icon: 'A' },
    { id: 'team', label: t.builder, icon: 'B' },
    { id: 'calculator', label: t.typeChart, icon: 'T' },
  ];

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-20 transition-colors duration-300">
      {/* Top Desktop Nav */}
      <nav className="hidden md:flex fixed top-0 w-full bg-za-light/90 dark:bg-za-dark/90 backdrop-blur-md border-b border-gray-200 dark:border-white/10 z-50 px-8 py-4 items-center justify-between shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setView('meta')}>
            {/* Custom Architectural Z-A Monogram Logo */}
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_5px_rgba(0,243,255,0.2)]">
                <defs>
                    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00f3ff" />
                        <stop offset="100%" stopColor="#ff00ff" />
                    </linearGradient>
                </defs>
                
                {/* Structural Hexagon Frame */}
                <path d="M50 5 L93 30 V80 L50 105 L7 80 V30 Z" stroke="#334155" strokeWidth="2" fill="none" className="opacity-20" />
                
                {/* The "Z" Component - Sharp Tech Look */}
                <path d="M25 35 H65 L35 75 H75" stroke="url(#logoGrad)" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
                
                {/* The "A" Component - Integrated Bar */}
                <path d="M50 35 V75" stroke="#ffffff" strokeWidth="2" strokeLinecap="square" className="opacity-0 dark:opacity-40" />
                <circle cx="50" cy="55" r="2" fill="#00f3ff" className="animate-pulse" />
            </svg>
            <div className="flex flex-col">
                <span className="font-display font-bold text-2xl tracking-widest text-slate-800 dark:text-white leading-none">
                    Z-A
                </span>
                <span className="text-[10px] font-mono text-za-cyan tracking-[0.2em] leading-none opacity-80 group-hover:text-za-magenta transition-colors">
                    META
                </span>
            </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="flex gap-6">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`font-display text-sm uppercase tracking-wider transition-all duration-300 relative group ${
                  currentView === item.id 
                    ? 'text-za-cyan font-bold' 
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
                {currentView === item.id && (
                    <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-za-cyan shadow-[0_0_8px_#00f3ff]"></span>
                )}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-gray-300 dark:bg-white/20"></div>

          {/* Controls Group */}
          <div className="flex items-center gap-4">
             {/* Generation Selector */}
             <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase">{t.genSelect}</label>
                <div className="relative group">
                    <select 
                    value={generation}
                    onChange={(e) => setGeneration(e.target.value as Generation)}
                    className="appearance-none bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/20 text-slate-700 dark:text-gray-200 text-xs font-bold font-display px-4 py-1.5 rounded focus:outline-none focus:border-za-cyan cursor-pointer pr-8 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors w-40"
                    >
                    {GENERATIONS.map(gen => (
                        <option key={gen.id} value={gen.id}>
                        {lang === 'zh' ? gen.labelZh : gen.labelEn}
                        </option>
                    ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500 dark:text-gray-400">
                    <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
             </div>

             {/* Season Selector (Only for Z-A) */}
             {generation === 'legends-za' && (
                <div className="flex flex-col gap-1 animate-fade-in">
                    <label className="text-[10px] text-za-magenta font-bold uppercase">{t.seasonZA}</label>
                    <div className="relative group">
                        <select 
                        value={season}
                        onChange={(e) => setSeason(e.target.value as Regulation)}
                        className="appearance-none bg-za-magenta/10 border border-za-magenta/30 text-za-magenta text-xs font-bold font-display px-4 py-1.5 rounded focus:outline-none focus:border-za-magenta cursor-pointer pr-8 hover:bg-za-magenta/20 transition-colors w-40"
                        >
                        {SEASONS.map(s => (
                            <option key={s.id} value={s.id}>
                            {lang === 'zh' ? s.labelZh : s.labelEn}
                            </option>
                        ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-za-magenta">
                        <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>
             )}

             {/* Language Switch */}
             <button 
                onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
                className="mt-4 text-xs font-bold font-display px-2 py-1 rounded border border-gray-300 dark:border-white/20 text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
             >
               {lang === 'en' ? 'CN' : 'EN'}
             </button>

             {/* Theme Switch */}
             <button
               onClick={toggleTheme}
               className="mt-4 p-1.5 rounded-full bg-gray-100 dark:bg-white/10 text-slate-600 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
               aria-label="Toggle Theme"
             >
               {theme === 'dark' ? (
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
               )}
             </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-screen pt-4 md:pt-0">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white/90 dark:bg-za-dark/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] dark:shadow-none">
        <div className="flex justify-around items-center p-2">
           {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors w-full ${
                currentView === item.id ? 'bg-za-cyan/10 dark:bg-white/5' : ''
              }`}
            >
              <span className={`font-display font-bold text-lg ${currentView === item.id ? 'text-za-cyan' : 'text-slate-400 dark:text-gray-500'}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] uppercase font-bold ${currentView === item.id ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-gray-600'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
        
        {/* Mobile Top Bar Controls - Just simplified for mobile */}
        <div className="absolute bottom-20 right-4 flex flex-col gap-2 items-end">
             {generation === 'legends-za' && (
                <div className="bg-za-dark/90 p-2 rounded-lg border border-za-magenta/30 shadow-lg">
                    <div className="text-[10px] text-za-magenta font-bold mb-1 uppercase">{t.seasonZA}</div>
                    <select 
                        value={season}
                        onChange={(e) => setSeason(e.target.value as Regulation)}
                        className="bg-transparent text-white text-xs font-bold font-display focus:outline-none w-24"
                    >
                    {SEASONS.map(s => (
                        <option key={s.id} value={s.id}>
                        {lang === 'zh' ? s.labelZh : s.labelEn}
                        </option>
                    ))}
                    </select>
                </div>
             )}
        </div>
      </nav>
    </div>
  );
};
