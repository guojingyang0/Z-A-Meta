import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { MetaDashboard } from './components/MetaDashboard';
import { PokemonAnalyzer } from './components/PokemonAnalyzer';
import { TeamBuilder } from './components/TeamBuilder';
import { TeamSynergy } from './components/TeamSynergy';
import { TypeCalculator } from './components/TypeCalculator';
import { ViewState, Language, Theme, Generation, Regulation, MetaPokemonData, PokemonAnalysis } from './types';
import { clearMemoryCache } from './services/geminiService';
import { seedDatabase } from './services/storageService';

function App() {
  const [currentView, setView] = useState<ViewState>('meta');
  const [lang, setLang] = useState<Language>('zh'); 
  const [theme, setTheme] = useState<Theme>('light'); 
  const [generation, setGeneration] = useState<Generation>('legends-za');
  const [season, setSeason] = useState<Regulation>('season3'); 
  const [selectedPokemon, setSelectedPokemon] = useState<string | undefined>(undefined);

  // Persistent States
  const [metaDataCache, setMetaDataCache] = useState<{key: string, data: MetaPokemonData[]} | null>(null);
  const [analyzerCache, setAnalyzerCache] = useState<PokemonAnalysis | null>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Seed DB on Mount
  useEffect(() => {
    seedDatabase().catch(err => console.warn("DB Seeding failed", err));
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleAnalyzeRequest = (pokemonName: string) => {
    setSelectedPokemon(pokemonName);
    setView('analyze');
  };

  const handleMetaUpdate = (key: string, data: MetaPokemonData[]) => {
    setMetaDataCache({ key, data });
  };

  const handleAnalyzerUpdate = (data: PokemonAnalysis) => {
    setAnalyzerCache(data);
  };

  const handleSettingsChange = () => {
    clearMemoryCache();
    setMetaDataCache(null);
    setAnalyzerCache(null);
  };

  const renderView = () => {
    switch (currentView) {
      case 'meta':
        return (
            <MetaDashboard 
                lang={lang} 
                generation={generation} 
                season={season}
                onAnalyze={handleAnalyzeRequest}
                cachedData={metaDataCache}
                onUpdateCache={handleMetaUpdate}
            />
        );
      case 'analyze':
        return (
            <PokemonAnalyzer 
                lang={lang} 
                generation={generation} 
                season={season}
                initialSearch={selectedPokemon}
                cachedData={analyzerCache}
                onAnalyzeComplete={handleAnalyzerUpdate}
            />
        );
      case 'team':
        return <TeamBuilder lang={lang} generation={generation} season={season} />;
      case 'calculator':
        return <TypeCalculator lang={lang} />; 
      default:
        return (
            <MetaDashboard 
                lang={lang} 
                generation={generation} 
                season={season}
                onAnalyze={handleAnalyzeRequest}
                cachedData={metaDataCache}
                onUpdateCache={handleMetaUpdate}
            />
        );
    }
  };

  return (
    <Layout 
      currentView={currentView} 
      setView={setView}
      lang={lang}
      setLang={setLang}
      theme={theme}
      toggleTheme={toggleTheme}
      generation={generation}
      setGeneration={setGeneration}
      season={season}
      setSeason={setSeason}
      onSettingsChanged={handleSettingsChange}
    >
      <div className="animate-fade-in">
        {renderView()}
      </div>
    </Layout>
  );
}

export default App;