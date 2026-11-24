export function localDatabase(sqlite) {
  return {
    prepare(query) {
      const statement = sqlite.prepare(query);
      return { bind: (...args) => ({
        first: async () => statement.get(...args),
        all: async () => ({ results: statement.all(...args) }),
        run: async () => ({ meta: statement.run(...args) })
      }) };
    }
  };
}
