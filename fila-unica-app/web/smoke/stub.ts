// localStorage de mentira, para o mock rodar fora do navegador.
const m = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k),
  clear: () => m.clear(),
  key: () => null,
  length: 0,
};
