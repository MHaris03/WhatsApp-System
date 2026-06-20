/**
 * Holds the database persistence API (from config/database.initDb) as a
 * singleton so any module can reach it without circular imports. `null` until
 * the DB connects — callers must null-check (the app runs without persistence
 * if the DB is unavailable).
 */
let store = null;

module.exports = {
  setStore: (s) => { store = s; },
  getStore: () => store,
};
