/**
 * In-memory stand-in for the Supabase client. test/setup.ts makes createClient() return testDb.client,
 * so no test can read or write a real project. It supports the query-builder calls the API uses.
 *
 *   testDb.seed('doctors', [{ id: 'd1', pin: '...' }])
 *   testDb.fail('doctors', { op: 'select' })   // next matching query returns an error
 *   testDb.rows('alerts'), testDb.calls          // inspect what happened
 *
 * Everything is cleared after each test by test/setup.ts.
 */
import { randomUUID } from 'node:crypto'

export type Row = Record<string, unknown>
export type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert'
export interface DbError { message: string; code: string }
export interface Result { data: unknown; error: DbError | null }
interface Failure { table: string; op?: Op; error: DbError; times: number }

const tables = new Map<string, Row[]>()
const failures: Failure[] = []
const calls: { table: string; op: Op }[] = []
const buckets = new Map<string, Map<string, unknown>>()

const copy = (r: Row): Row => structuredClone(r)
type Comparable = string | number
const cmp = (a: unknown, b: unknown) => (a as Comparable) < (b as Comparable) ? -1 : (a as Comparable) > (b as Comparable) ? 1 : 0

class Query implements PromiseLike<Result> {
  private readonly table: string
  private op: Op = 'select'
  private filters: ((r: Row) => boolean)[] = []
  private payload: Row[] = []
  private patch: Row = {}
  private returning = false
  private columns = '*'
  private mode: 'many' | 'single' | 'maybe' = 'many'
  private max = Infinity
  private sort: { col: string; asc: boolean } | null = null
  private conflict = ['id']

  constructor(table: string) {
    this.table = table
  }

  select(columns = '*') {
    if (this.op !== 'select') this.returning = true
    this.columns = columns
    return this
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = ([] as Row[]).concat(rows); return this }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert'
    this.payload = ([] as Row[]).concat(rows)
    if (opts?.onConflict) this.conflict = opts.onConflict.split(',').map((s) => s.trim())
    return this
  }
  update(patch: Row) { this.op = 'update'; this.patch = patch; return this }
  delete() { this.op = 'delete'; return this }

  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this }
  neq(col: string, val: unknown) { this.filters.push((r) => r[col] !== val); return this }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this }
  gt(col: string, val: unknown) { this.filters.push((r) => cmp(r[col], val) > 0); return this }
  gte(col: string, val: unknown) { this.filters.push((r) => cmp(r[col], val) >= 0); return this }
  lt(col: string, val: unknown) { this.filters.push((r) => cmp(r[col], val) < 0); return this }
  lte(col: string, val: unknown) { this.filters.push((r) => cmp(r[col], val) <= 0); return this }
  is(col: string, val: unknown) { this.filters.push((r) => (r[col] ?? null) === val); return this }
  order(col: string, opts?: { ascending?: boolean }) { this.sort = { col, asc: opts?.ascending ?? true }; return this }
  limit(n: number) { this.max = n; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  single() { this.mode = 'single'; return this }

  then<A = Result, B = never>(onOk?: ((v: Result) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(onOk, onErr)
  }

  private run(): Result {
    calls.push({ table: this.table, op: this.op })
    const failure = failures.find((f) => f.table === this.table && (!f.op || f.op === this.op) && f.times > 0)
    if (failure) {
      failure.times--
      return { data: null, error: failure.error }
    }
    const rows = tables.get(this.table) ?? []
    tables.set(this.table, rows)
    const match = (r: Row) => this.filters.every((fn) => fn(r))

    let out: Row[]
    switch (this.op) {
      case 'select':
        out = rows.filter(match)
        break
      case 'insert':
        out = this.payload.map((p) => ({ id: randomUUID(), ...copy(p) }))
        // Like the primary key in Postgres: a repeated id fails the whole insert
        if (out.some((r, i) => rows.some((x) => x.id === r.id) || out.findIndex((y) => y.id === r.id) !== i)) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } }
        }
        rows.push(...out)
        break
      case 'update':
        out = rows.filter(match)
        for (const r of out) Object.assign(r, copy(this.patch))
        break
      case 'delete':
        out = rows.filter(match)
        tables.set(this.table, rows.filter((r) => !out.includes(r)))
        break
      case 'upsert':
        out = this.payload.map((p) => {
          const existing = rows.find((r) => this.conflict.every((c) => r[c] === p[c]))
          if (existing) return Object.assign(existing, copy(p))
          const row = { id: randomUUID(), ...copy(p) }
          rows.push(row)
          return row
        })
        break
    }
    if (this.op !== 'select' && !this.returning) return { data: null, error: null }

    if (this.sort) {
      const { col, asc } = this.sort
      out = [...out].sort((a, b) => cmp(a[col], b[col]) * (asc ? 1 : -1))
    }
    out = out.slice(0, this.max).map((r) => this.project(r))

    if (this.mode === 'many') return { data: out, error: null }
    if (out.length > 1 || (this.mode === 'single' && out.length === 0)) {
      return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } }
    }
    return { data: out[0] ?? null, error: null }
  }

  private project(r: Row): Row {
    if (this.columns.trim() === '*') return copy(r)
    const out: Row = {}
    for (const c of this.columns.split(',').map((s) => s.trim())) out[c] = structuredClone(r[c])
    return out
  }
}

const bucket = (name: string) => {
  if (!buckets.has(name)) buckets.set(name, new Map())
  return buckets.get(name)!
}

const storage = {
  from: (name: string) => ({
    upload: async (path: string, body: unknown) => {
      bucket(name).set(path, body)
      return { data: { path }, error: null }
    },
    list: async (prefix = '', opts?: { search?: string; limit?: number }) => ({
      data: [...bucket(name).keys()]
        .filter((k) => k.startsWith(prefix) && (!opts?.search || k.includes(opts.search)))
        .slice(0, opts?.limit ?? 100)
        .map((n) => ({ name: n })),
      error: null,
    }),
    remove: async (paths: string[]) => {
      for (const p of paths) bucket(name).delete(p)
      return { data: paths.map((n) => ({ name: n })), error: null }
    },
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://supabase.test.invalid/storage/v1/object/public/${name}/${path}` } }),
  }),
}

export const testDb = {
  /** What createClient() returns during tests */
  client: { from: (table: string) => new Query(table), storage },
  /** Every query run, in order */
  calls,
  seed(table: string, rows: Row[]) {
    tables.set(table, [...(tables.get(table) ?? []), ...rows.map(copy)])
  },
  rows(table: string): Row[] {
    return (tables.get(table) ?? []).map(copy)
  },
  files(name: string): string[] {
    return [...bucket(name).keys()]
  },
  /** Make the next `times` matching queries return a database error */
  fail(table: string, opts: { op?: Op; message?: string; code?: string; times?: number } = {}) {
    failures.push({ table, op: opts.op, error: { message: opts.message ?? 'simulated database failure', code: opts.code ?? 'XX000' }, times: opts.times ?? 1 })
  },
  reset() {
    tables.clear()
    failures.length = 0
    calls.length = 0
    buckets.clear()
  },
}
