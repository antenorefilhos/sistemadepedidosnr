/**
 * Cache em memoria para as leituras publicas pesadas da vitrine (08/10/2026).
 *
 * A Home pede ~10 endpoints ao mesmo tempo. Sozinhos eles levam 70-580 ms; em
 * paralelo, no mesmo processo Node, a taxonomia comercial (varre o catalogo
 * inteiro e monta 19 vitrines) e a listagem de produtos seguravam o resto e
 * cada chamada passava de 1,3 s. O dado e o mesmo para todo cliente, entao:
 *
 * - dentro do `ttlMs`, responde da memoria;
 * - vencido (ate `staleMs` a mais), responde o anterior e atualiza por tras;
 * - chamadas simultaneas para a mesma chave esperam UMA so montagem;
 * - no maximo MAX_ENTRIES chaves (busca livre gera muitas): sai a mais antiga.
 *
 * So para resposta que nao depende de quem pede. Preco e disponibilidade que
 * valem dinheiro sao recalculados no checkout de qualquer jeito.
 */
const MAX_ENTRIES = 400

type Entry = { value: unknown; freshUntil: number; staleUntil: number }
const store = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()

function load<T>(key: string, ttlMs: number, staleMs: number, loader: () => Promise<T>): Promise<T> {
  const running = inflight.get(key)
  if (running) return running as Promise<T>
  const promise = loader()
    .then((value) => {
      const now = Date.now()
      store.delete(key)
      store.set(key, { value, freshUntil: now + ttlMs, staleUntil: now + ttlMs + staleMs })
      while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string)
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>, staleMs = 2 * 60_000): Promise<T> {
  const hit = store.get(key)
  const now = Date.now()
  if (hit && hit.freshUntil > now) return hit.value as T
  if (hit && hit.staleUntil > now) {
    // Responde o anterior; erro na atualizacao por tras nao derruba ninguem.
    load(key, ttlMs, staleMs, loader).catch(() => undefined)
    return hit.value as T
  }
  return load(key, ttlMs, staleMs, loader)
}

/** Apaga as chaves que comecam com `prefix` (mudanca no admin vale na hora). */
export function invalidateCached(prefix: string) {
  for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key)
}

/** So para teste. */
export function resetMemoryCache() {
  store.clear()
  inflight.clear()
}
