// Supabase returns at most 1,000 rows per request whatever .limit() says, so
// report totals silently undercount once there are more orders than that.
// This pages through with .range() until everything (up to `max`) is loaded.
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>

export async function fetchAllRows<T>(page: (from: number, to: number) => Page<T>, max = 50000, size = 1000): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = []
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, Math.min(from + size, max) - 1)
    if (error) return { data: rows, error }
    rows.push(...(data || []))
    if (!data || data.length < size) break
  }
  return { data: rows, error: null }
}
