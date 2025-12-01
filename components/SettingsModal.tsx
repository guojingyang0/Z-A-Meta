import React, { useState, useEffect } from 'react';
import { AISettings, AIProvider, Language } from '../types';
import { TRANSLATIONS } from '../utils/translations';
import { testAPIConnection } from '../services/geminiService';
import { clearDatabase } from '../services/storageService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
  lang: Language;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, onSettingsChanged, lang }) => {
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [dbCleared, setDbCleared] = useState(false);
  
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('za_meta_ai_settings');
      if (stored) {
        try {
          const parsed: AISettings = JSON.parse(stored);
          setProvider(parsed.provider);
          setApiKey(parsed.apiKey || '');
          setBaseUrl(parsed.baseUrl || '');
          setModel(parsed.model || '');
        } catch (e) {
          console.error("Failed to load settings", e);
        }
      }
      setTestStatus('idle');
      setTestMessage('');
      setDbCleared(false);
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
      if (!apiKey) return;
      setTestStatus('loading');
      setTestMessage('');
      
      const settings: AISettings = {
          provider, apiKey, baseUrl, model
      };
      
      const result = await testAPIConnection(settings);
      setTestStatus(result.success ? 'success' : 'failed');
      if (result.message) {
          setTestMessage(result.message);
      }
      
      if (result.success) {
        setTimeout(() => {
            if (isOpen) setTestStatus('idle');
        }, 3000);
      }
  };

  const handleSave = () => {
    const settings: AISettings = {
      provider,
      apiKey,
      baseUrl,
      model
    };
    localStorage.setItem('za_meta_ai_settings', JSON.stringify(settings));
    
    if (onSettingsChanged) {
        onSettingsChanged();
    }
    onClose();
  };

  const handleClear = () => {
    localStorage.removeItem('za_meta_ai_settings');
    if (onSettingsChanged) {
        onSettingsChanged();
    }
    onClose();
  };

  const handleClearDB = async () => {
      await clearDatabase();
      setDbCleared(true);
      setTimeout(() => setDbCleared(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-za-panel border border-za-cyan/30 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-za-dark to-slate-900 p-6 border-b border-gray-700">
          <div className="flex justify-between items-center">
             <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
               <span className="text-za-cyan">API</span> {t.settingsTitle.replace('API ', '')}
             </h2>
             <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
             </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {t.settingsDesc}
          </p>
        </div>

        <div className="p-6 space-y-8">
           {/* Provider Toggle */}
           <div className="grid grid-cols-2 gap-4">
             <button 
                onClick={() => setProvider('gemini')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${provider === 'gemini' ? 'border-za-cyan bg-za-cyan/10 text-za-cyan' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-400'}`}
             >
                <span className="font-display font-bold text-lg">GEMINI</span>
                <span className="text-[10px] opacity-70">{t.providerGemini}</span>
             </button>
             <button 
                onClick={() => setProvider('openai')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${provider === 'openai' ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-400'}`}
             >
                <span className="font-display font-bold text-lg">OPENAI</span>
                <span className="text-[10px] opacity-70">{t.providerOpenAI}</span>
             </button>
           </div>

           {/* API Fields */}
           <div className="space-y-4">
             <div>
               <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t.apiKeyLabel}</label>
               <div className="flex gap-2">
                   <input 
                      type="password" 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="flex-1 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-za-cyan transition-colors"
                   />
                   <button
                        onClick={handleTestConnection}
                        disabled={!apiKey || testStatus === 'loading'}
                        className={`px-3 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
                            testStatus === 'success' ? 'bg-green-500 text-white' :
                            testStatus === 'failed' ? 'bg-red-500 text-white' :
                            'bg-gray-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'
                        }`}
                        title={t.testConnection}
                   >
                        {testStatus === 'loading' ? (
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                        ) : testStatus === 'success' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : testStatus === 'failed' ? (
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                        )}
                   </button>
               </div>
               
               {testStatus === 'failed' && testMessage && (
                   <div className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-500/30 animate-fade-in flex items-start gap-2 break-all">
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                       <span>{testMessage}</span>
                   </div>
               )}
             </div>

             <div>
               <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t.baseUrlLabel}</label>
               <input 
                  type="text" 
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={provider === 'gemini' ? 'https://generativelanguage.googleapis.com' : 'https://api.openai.com/v1'}
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-za-cyan transition-colors font-mono"
               />
               <p className="text-[10px] text-gray-400 mt-1">{t.baseUrlDesc}</p>
             </div>

             <div>
               <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t.modelLabel}</label>
               <input 
                  list="model-suggestions"
                  type="text" 
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t.modelPlaceholder}
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-za-cyan transition-colors font-mono"
               />
               <datalist id="model-suggestions">
                   {provider === 'gemini' ? (
                       <>
                           <option value="gemini-1.5-flash" />
                           <option value="gemini-1.5-pro" />
                           <option value="gemini-2.0-flash" />
                           <option value="gemini-2.0-pro" />
                       </>
                   ) : (
                       <>
                           <option value="gpt-4o" />
                           <option value="gpt-4o-mini" />
                           <option value="gpt-4-turbo" />
                       </>
                   )}
               </datalist>
             </div>
           </div>

           {/* Data Management Section */}
           <div className="pt-4 border-t border-gray-200 dark:border-white/10">
               <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">{t.dataManagement}</label>
               <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-4 flex justify-between items-center">
                   <div>
                       <div className="font-bold text-sm text-slate-800 dark:text-gray-200">{t.clearDbTitle}</div>
                       <div className="text-xs text-gray-400">{t.clearDbDesc}</div>
                   </div>
                   <button 
                       onClick={handleClearDB}
                       className={`px-3 py-1.5 rounded border text-xs font-bold transition-all ${
                           dbCleared 
                           ? 'bg-green-500 border-green-500 text-white' 
                           : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                       }`}
                   >
                       {dbCleared ? t.cleared : t.clearBtn}
                   </button>
               </div>
           </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-black/20 p-6 border-t border-gray-200 dark:border-white/5 flex justify-between items-center">
            <button 
               onClick={handleClear}
               className="text-xs text-red-500 hover:text-red-400 font-bold px-2 py-1"
            >
              {t.resetBtn}
            </button>
            <div className="flex gap-3">
               <button 
                 onClick={onClose}
                 className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
               >
                 {t.cancelBtn}
               </button>
               <button 
                 onClick={handleSave}
                 className="px-6 py-2 rounded-lg bg-za-cyan hover:bg-cyan-400 text-black text-sm font-bold shadow-lg shadow-za-cyan/20 transition-all"
               >
                 {t.saveBtn}
               </button>
            </div>
        </div>
      </div>
    </div>
  );
};