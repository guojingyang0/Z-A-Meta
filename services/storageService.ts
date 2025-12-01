import { PokemonAnalysis, MetaPokemonData, MetaTeamData } from '../types';
import { PRELOADED_POKEMON_LIST } from '../utils/preloadedData';

const DB_NAME = 'ZAMetaDB';
const DB_VERSION = 2;
const STORE_ANALYSIS = 'analysis';
const STORE_META = 'meta';
const STORE_TEAMS = 'teams';

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve();
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB Error:", event);
      reject("Failed to open database");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_ANALYSIS)) {
        db.createObjectStore(STORE_ANALYSIS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_TEAMS)) {
        db.createObjectStore(STORE_TEAMS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve();
    };
  });
};

export const seedDatabase = async () => {
  if (!dbInstance) await initDB();
  if (!dbInstance) return;

  const transaction = dbInstance.transaction([STORE_ANALYSIS], 'readwrite');
  const store = transaction.objectStore(STORE_ANALYSIS);

  const countRequest = store.count();
  
  countRequest.onsuccess = () => {
    if (countRequest.result === 0) {
      console.log("Seeding Database with Top 30 Pokémon...");
      PRELOADED_POKEMON_LIST.forEach(mon => {
        // Generate a unique ID for storage based on name/gen/season key format
        // We assume this data is for legends-za-season3
        const key = `analysis-legends-za-season3-${mon.nameEn.toLowerCase().trim().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '')}`;
        store.put({ ...mon, id: key });
      });
      console.log("Seeding Complete.");
    }
  };
};

export const saveAnalysis = async (key: string, data: PokemonAnalysis): Promise<void> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_ANALYSIS], 'readwrite');
        const store = transaction.objectStore(STORE_ANALYSIS);
        const request = store.put({ ...data, id: key });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getAnalysis = async (key: string): Promise<PokemonAnalysis | null> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_ANALYSIS], 'readonly');
        const store = transaction.objectStore(STORE_ANALYSIS);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const getAllAnalysis = async (): Promise<PokemonAnalysis[]> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_ANALYSIS], 'readonly');
        const store = transaction.objectStore(STORE_ANALYSIS);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const saveMeta = async (key: string, data: MetaPokemonData[]): Promise<void> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_META], 'readwrite');
        const store = transaction.objectStore(STORE_META);
        const request = store.put({ key, data });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getMeta = async (key: string): Promise<MetaPokemonData[] | null> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_META], 'readonly');
        const store = transaction.objectStore(STORE_META);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => reject(request.error);
    });
};

export const saveMetaTeams = async (key: string, data: MetaTeamData[]): Promise<void> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_TEAMS], 'readwrite');
        const store = transaction.objectStore(STORE_TEAMS);
        const request = store.put({ key, data });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getMetaTeams = async (key: string): Promise<MetaTeamData[] | null> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_TEAMS], 'readonly');
        const store = transaction.objectStore(STORE_TEAMS);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => reject(request.error);
    });
};

export const clearDatabase = async (): Promise<void> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_ANALYSIS, STORE_META, STORE_TEAMS], 'readwrite');
        transaction.objectStore(STORE_ANALYSIS).clear();
        transaction.objectStore(STORE_META).clear();
        transaction.objectStore(STORE_TEAMS).clear();
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};
