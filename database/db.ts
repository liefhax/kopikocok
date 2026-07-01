import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDB = async () => {
  if (dbInstance) {
    return dbInstance;
  }
  
  try {
    dbInstance = await SQLite.openDatabaseAsync('kopikocok.db');
    return dbInstance;
  } catch (error) {
    console.error("❌ Gagal membuka database:", error);
    throw error;
  }
};

export const closeDB = async () => {
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
      dbInstance = null;
    } catch (error) {
      console.error("❌ Gagal menutup database:", error);
    }
  }
};

export const setupDatabase = async () => {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return;
  }

  let db: SQLite.SQLiteDatabase | null = null;
  
  try {
    db = await getDB();
    console.log(`⏳ Memulai setup database di platform: ${Platform.OS}...`);
    
    // 1. Buat tabel utama dengan transaksi
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        stock REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0 
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY, 
        value TEXT
      );
      
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT UNIQUE
      );

      CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT UNIQUE
      );
    `);

    // 2. Migrasi Kolom Lama dengan pengecekan
    const tableInfo = await db.getAllAsync<{name: string}>('PRAGMA table_info(items)');
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('description')) {
      try { await db.execAsync(`ALTER TABLE items ADD COLUMN description TEXT;`); } catch (e) {}
    }
    if (!columnNames.includes('image_uri')) {
      try { await db.execAsync(`ALTER TABLE items ADD COLUMN image_uri TEXT;`); } catch (e) {}
    }
    if (!columnNames.includes('cost_price')) {
      try { await db.execAsync(`ALTER TABLE items ADD COLUMN cost_price REAL DEFAULT 0;`); } catch (e) {}
    }
    if (!columnNames.includes('sell_price')) {
      try { await db.execAsync(`ALTER TABLE items ADD COLUMN sell_price REAL DEFAULT 0;`); } catch (e) {}
    }
    
    // 3. Insert Default Settings
    await db.runAsync(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('low_stock_threshold', '5')`);

    // 4. Migrasi Kategori
    const catCount = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM categories');
    if (catCount?.count === 0) {
      const defaultsC = ['Biji Kopi', 'Susu', 'Sirup', 'Gelas/Cup', 'Snack'];
      for (let c of defaultsC) {
        await db.runAsync('INSERT OR IGNORE INTO categories (name) VALUES (?)', [c]);
      }
      try {
        const existingCats = await db.getAllAsync<{category: string}>('SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category != ""');
        for (let c of existingCats) {
          if (c.category) {
            await db.runAsync('INSERT OR IGNORE INTO categories (name) VALUES (?)', [c.category]);
          }
        }
      } catch (e) {}
    }

    // 5. Migrasi Satuan
    const unitCount = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM units');
    if (unitCount?.count === 0) {
      const defaultsU = ['Gram', 'Kilogram', 'Liter', 'Mililiter', 'Pcs'];
      for (let u of defaultsU) {
        await db.runAsync('INSERT OR IGNORE INTO units (name) VALUES (?)', [u]);
      }
      try {
        const existingUnits = await db.getAllAsync<{unit: string}>('SELECT DISTINCT unit FROM items WHERE unit IS NOT NULL AND unit != ""');
        for (let u of existingUnits) {
          if (u.unit) {
            await db.runAsync('INSERT OR IGNORE INTO units (name) VALUES (?)', [u.unit]);
          }
        }
      } catch (e) {}
    }

    console.log("✅ Keseluruhan Database dan Tabel siap digunakan!");
  } catch (error) {
    console.error("❌ Gagal menyiapkan database:", error);
    throw error;
  }
};

// Helper function untuk menjalankan query dengan error handling yang lebih baik
export const executeQuery = async <T = any>(
  query: string, 
  params: any[] = []
): Promise<T[]> => {
  try {
    const db = await getDB();
    return await db.getAllAsync<T>(query, params);
  } catch (error) {
    console.error("❌ Gagal menjalankan query:", query, error);
    throw error;
  }
};

export const executeRun = async (
  query: string, 
  params: any[] = []
): Promise<{ changes: number; lastInsertRowId: number }> => {
  try {
    const db = await getDB();
    return await db.runAsync(query, params);
  } catch (error) {
    console.error("❌ Gagal menjalankan query:", query, error);
    throw error;
  }
};

export const executeFirst = async <T = any>(
  query: string, 
  params: any[] = []
): Promise<T | null> => {
  try {
    const db = await getDB();
    return await db.getFirstAsync<T>(query, params);
  } catch (error) {
    console.error("❌ Gagal menjalankan query:", query, error);
    throw error;
  }
};