/**
 * Implémentation SUPABASE des services (schéma isolé `point_chaud`).
 * À valider au branchement (migrations appliquées + clé anon dans .env.local).
 */
import { supabase } from '@/lib/supabase'
import type {
  DataServices,
  Product,
  Supplier,
  Prepa,
  ExitLine,
  ReceptionLine,
  Category,
  ProductInput,
  PrepaInput,
  SupplierInput,
  CategoryInput,
  CountLine,
  InventoryRecord,
  PurchaseOrder,
  PlaceOrderInput,
  AppSettings,
  ExitHistoryEntry,
} from '@/services/types'
import type { SupplierCalendar, Weekday } from '@/lib/orderCalendar'
import { toParisCivil, weekday } from '@/lib/orderCalendar'
import { WEEKDAYS_SHORT } from '@/lib/format'

function client() {
  if (!supabase) throw new Error('Supabase non configuré (voir .env.local)')
  return supabase
}

/** PostgREST renvoie une relation 1-1 comme objet, et une relation 1-n comme tableau. */
function relatedOne(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

function supplierCalendar(row: Record<string, unknown>): SupplierCalendar {
  const mode = (row.delivery_mode as string) === 'mapping' ? 'mapping' : 'lead'
  return {
    orderDays: (row.order_days as Weekday[]) ?? [],
    cutoff: ((row.cutoff_time as string) ?? '11:00').slice(0, 5),
    delivery:
      mode === 'mapping'
        ? {
            mode: 'mapping',
            map:
              (row.delivery_map as { orderDay: Weekday; deliveryDay: Weekday; weeksAhead: number }[]) ??
              [],
          }
        : {
            mode: 'lead',
            leadDays: (row.lead_days as number) ?? 1,
            leadKind: (row.lead_kind as 'calendar' | 'business') ?? 'calendar',
            noWeekendDelivery: (row.no_weekend_delivery as boolean) ?? true,
          },
  }
}

function deliveryLabel(orderDays: number[]): string {
  return orderDays.map((d) => WEEKDAYS_SHORT[d] ?? '?').join(' · ')
}

async function listOrders(status: string | null, limit = 100): Promise<PurchaseOrder[]> {
  let query = client()
    .from('purchase_orders')
    .select(`
      id, supplier_id, status, cover_from, cover_until, channel, sent_at, created_at, created_by,
      supplier:suppliers(name),
      lines:purchase_order_lines(
        product_id, pack_size, proposed_packs, checked_packs, final_packs, visual_check, note
      )
    `)
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (status) query = query.eq('status', status)

  const [{ data, error }, { data: profiles, error: profileError }] = await Promise.all([
    query,
    client().from('profiles').select('id, display_name'),
  ])
  if (error) throw error
  if (profileError) throw profileError

  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]))
  return (data ?? []).map((row): PurchaseOrder => {
    const supplier = relatedOne(row.supplier)
    const actor = row.created_by as string | null
    return {
      id: row.id as string,
      supplierId: row.supplier_id as string,
      supplierName: (supplier?.name as string) ?? 'Fournisseur',
      status: row.status as string,
      coverFrom: (row.cover_from as string | null) ?? null,
      coverUntil: (row.cover_until as string | null) ?? null,
      channel: (row.channel as string) ?? 'phone',
      orderedAt: ((row.sent_at ?? row.created_at) as string),
      orderedBy: actor,
      orderedByName: (actor && names.get(actor)) || 'Utilisateur inconnu',
      lines: ((row.lines as Record<string, unknown>[]) ?? []).map((line) => ({
        productId: line.product_id as string,
        packSize: line.pack_size as number,
        proposedPacks: (line.proposed_packs as number) ?? 0,
        checkedPacks: (line.checked_packs as number | null) ?? null,
        finalPacks: (line.final_packs as number) ?? 0,
        visualCheck: (line.visual_check as PurchaseOrder['lines'][number]['visualCheck']) ?? null,
        note: (line.note as string) ?? '',
      })),
    }
  })
}

export const supabaseServices: DataServices = {
  source: 'supabase',

  catalog: {
    async listSuppliers(): Promise<Supplier[]> {
      const { data, error } = await client()
        .from('suppliers')
        .select('*')
        .eq('active', true)
        .order('name')
      if (error) throw error
      const todayW = weekday(toParisCivil(new Date()))
      return (data ?? []).map((row) => {
        const orderDays = (row.order_days as number[]) ?? []
        return {
          id: row.id as string,
          name: row.name as string,
          phone: (row.phone as string) ?? '',
          orderDays,
          deliveryLabel: deliveryLabel(orderDays),
          dueToday: orderDays.includes(todayW),
          calendar: supplierCalendar(row),
        }
      })
    },

    async listProducts(): Promise<Product[]> {
      const db = client()
      const [{ data: products, error: e1 }, { data: bal, error: e2 }] = await Promise.all([
        db
          .from('products')
          .select(
            `id, name, internal_ref, location_id, min_units, max_units, is_favorite,
             category:product_categories(id, name, position),
             supplier_products(supplier_id, supplier_ref, pack_size, order_unit, min_order_packs, order_multiple_packs),
             forecast:forecast_settings(conso_mon,conso_tue,conso_wed,conso_thu,conso_fri,conso_sat,conso_sun)`,
          )
          .eq('active', true),
        db.from('stock_balances').select('product_id, stock_units'),
      ])
      if (e1) throw e1
      if (e2) throw e2

      const balances: Record<string, number> = {}
      for (const b of bal ?? []) balances[b.product_id as string] = (b.stock_units as number) ?? 0

      return (products ?? []).map((row): Product => {
        const sp = relatedOne(row.supplier_products)
        const cat = row.category as { id?: string; name?: string; position?: number } | null
        const f = relatedOne(row.forecast) as Record<string, number> | null
        return {
          id: row.id as string,
          name: row.name as string,
          category: cat?.name ?? 'Autres',
          categoryId: cat?.id ?? null,
          categoryPosition: cat?.position ?? 99,
          supplierId: (sp?.supplier_id as string) ?? '',
          ref: (sp?.supplier_ref as string) ?? (row.internal_ref as string) ?? '',
          location: 'Congélateur',
          packSize: (sp?.pack_size as number) ?? 1,
          packLabel: (sp?.order_unit as string) ?? 'carton',
          minOrderPacks: (sp?.min_order_packs as number) ?? 1,
          orderMultiplePacks: (sp?.order_multiple_packs as number) ?? 1,
          stockUnits: balances[row.id as string] ?? 0,
          minUnits: (row.min_units as number) ?? 0,
          maxUnits: (row.max_units as number) ?? 0,
          isFavorite: (row.is_favorite as boolean) ?? false,
          conso: f
            ? [
                f.conso_mon ?? 0,
                f.conso_tue ?? 0,
                f.conso_wed ?? 0,
                f.conso_thu ?? 0,
                f.conso_fri ?? 0,
                f.conso_sat ?? 0,
                f.conso_sun ?? 0,
              ]
            : [0, 0, 0, 0, 0, 0, 0],
        }
      })
    },

    async listPrepas(): Promise<Prepa[]> {
      const db = client()
      const since = new Date()
      since.setHours(0, 0, 0, 0)
      const [{ data, error }, { data: runs, error: runsError }] = await Promise.all([
        db
          .from('prep_templates')
          .select('id, name, time_label, prep_template_lines(product_id, default_units)')
          .eq('active', true)
          .order('time_label'),
        db.from('prep_runs').select('template_id, run_at').gte('run_at', since.toISOString()),
      ])
      if (error) throw error
      if (runsError) throw runsError
      const lastRuns = new Map<string, string>()
      for (const run of runs ?? []) {
        const id = run.template_id as string
        const at = run.run_at as string
        if (!lastRuns.has(id) || at > lastRuns.get(id)!) lastRuns.set(id, at)
      }
      return (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        time: (row.time_label as string) ?? '',
        lastRunAt: lastRuns.get(row.id as string) ?? null,
        lines: ((row.prep_template_lines as Record<string, unknown>[]) ?? []).map((l) => ({
          productId: l.product_id as string,
          units: l.default_units as number,
        })),
      }))
    },

    async listCategories(): Promise<Category[]> {
      const { data, error } = await client()
        .from('product_categories')
        .select('id, name, position')
        .eq('active', true)
        .order('position')
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        position: (r.position as number) ?? 0,
      }))
    },
    async getSettings(): Promise<AppSettings> {
      const { data, error } = await client()
        .from('app_settings')
        .select('safety_deliveries, recalibration_threshold')
        .single()
      if (error) throw error
      return {
        safetyDeliveries: (data.safety_deliveries as number) ?? 1,
        recalibrationThreshold: Number(data.recalibration_threshold ?? 0.2),
      }
    },
  },

  orders: {
    async place(input: PlaceOrderInput): Promise<string> {
      const { data, error } = await client().rpc('place_purchase_order', {
        p_supplier_id: input.supplierId,
        p_cover_from: input.coverFrom,
        p_cover_until: input.coverUntil,
        p_lines: input.lines.map((line) => ({
          product_id: line.productId,
          proposed_packs: line.proposedPacks,
          checked_packs: line.checkedPacks,
          final_packs: line.finalPacks,
          visual_check: line.visualCheck,
          note: line.note || null,
        })),
        p_idempotency_key: input.idempotencyKey,
        p_channel: input.channel,
      })
      if (error) throw error
      return data as string
    },
    async listPendingReception(): Promise<PurchaseOrder[]> {
      return listOrders('ordered')
    },
    async listHistory(limit = 100): Promise<PurchaseOrder[]> {
      return listOrders(null, limit)
    },
  },

  stock: {
    async balances(): Promise<Record<string, number>> {
      const { data, error } = await client().from('stock_balances').select('product_id, stock_units')
      if (error) throw error
      const out: Record<string, number> = {}
      for (const b of data ?? []) out[b.product_id as string] = (b.stock_units as number) ?? 0
      return out
    },

    async recordExit(batchId, lines: ExitLine[], note, force = false, templateId = null): Promise<void> {
      const { error } = await client().rpc('record_exit', {
        p_batch_id: batchId,
        p_lines: lines.map((l) => ({ product_id: l.productId, units: l.units })),
        p_note: note ?? null,
        p_force: force,
        p_template_id: templateId,
      })
      if (error) throw error
    },
    async listExitHistory(limit = 30): Promise<ExitHistoryEntry[]> {
      const db = client()
      const [{ data, error }, { data: profiles, error: profilesError }] = await Promise.all([
        db
          .from('stock_movements')
          .select('prep_batch_id, prep_template_id, product_id, qty_units, note, created_at, created_by, product:products(name)')
          .eq('type', 'exit')
          .not('prep_batch_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(Math.max(limit * 12, limit)),
        db.from('profiles').select('id, display_name'),
      ])
      if (error) throw error
      if (profilesError) throw profilesError
      const names = new Map((profiles ?? []).map((profile) => [profile.id as string, profile.display_name as string]))
      const grouped = new Map<string, ExitHistoryEntry>()
      for (const row of data ?? []) {
        const batchId = row.prep_batch_id as string
        if (!grouped.has(batchId)) {
          const actor = row.created_by as string | null
          grouped.set(batchId, {
            batchId,
            createdAt: row.created_at as string,
            createdBy: actor,
            createdByName: (actor && names.get(actor)) || 'Utilisateur',
            note: (row.note as string) ?? '',
            templateId: (row.prep_template_id as string | null) ?? null,
            lines: [],
          })
        }
        grouped.get(batchId)!.lines.push({
          productId: row.product_id as string,
          productName: (relatedOne(row.product)?.name as string) ?? 'Produit',
          units: Math.abs(row.qty_units as number),
        })
      }
      return [...grouped.values()].slice(0, limit)
    },

    async recordReception(
      idempotencyKey: string,
      supplierId: string,
      orderId: string | null,
      lines: ReceptionLine[],
    ): Promise<void> {
      const { error } = await client().rpc('receive_delivery', {
        p_supplier_id: supplierId,
        p_order_id: orderId,
        p_lines: lines.map((l) => ({
          product_id: l.productId,
          ordered_units: l.orderedUnits,
          accepted_units: l.acceptedUnits,
          note: l.note ?? null,
        })),
        p_idempotency_key: idempotencyKey,
      })
      if (error) throw error
    },

    async recordInventory(kind, lines): Promise<void> {
      const { error } = await client().rpc('apply_inventory', {
        p_kind: kind,
        p_lines: lines.map((l) => ({ product_id: l.productId, counted_units: l.countedUnits })),
      })
      if (error) throw error
    },
  },

  admin: {
    async saveProduct(p: ProductInput): Promise<void> {
      const db = client()
      const id = p.id ?? crypto.randomUUID()
      const { error: e1 } = await db.from('products').upsert({
        id,
        site_id: p.siteId,
        category_id: p.categoryId,
        name: p.name,
        min_units: p.minUnits,
        max_units: p.maxUnits,
        active: true,
      })
      if (e1) throw e1
      await db.from('supplier_products').delete().eq('product_id', id)
      if (p.supplierId) {
        const { error: e2 } = await db.from('supplier_products').insert({
          site_id: p.siteId,
          supplier_id: p.supplierId,
          product_id: id,
          supplier_ref: p.supplierRef,
          order_unit: 'carton',
          pack_size: p.packSize,
          min_order_packs: p.minOrderPacks,
          order_multiple_packs: p.orderMultiplePacks,
        })
        if (e2) throw e2
      }
      const c = p.conso
      const { error: e3 } = await db.from('forecast_settings').upsert({
        product_id: id,
        site_id: p.siteId,
        conso_mon: c[0] ?? 0,
        conso_tue: c[1] ?? 0,
        conso_wed: c[2] ?? 0,
        conso_thu: c[3] ?? 0,
        conso_fri: c[4] ?? 0,
        conso_sat: c[5] ?? 0,
        conso_sun: c[6] ?? 0,
      })
      if (e3) throw e3
    },
    async setProductFavorite(id: string, isFavorite: boolean): Promise<void> {
      const { error } = await client().from('products').update({ is_favorite: isFavorite }).eq('id', id)
      if (error) throw error
    },
    async deleteProduct(id: string): Promise<void> {
      const { error } = await client().from('products').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    async saveSupplier(s: SupplierInput): Promise<void> {
      const id = s.id ?? crypto.randomUUID()
      const { error } = await client().from('suppliers').upsert({
        id,
        site_id: s.siteId,
        name: s.name,
        phone: s.phone,
        order_channel: 'phone',
        order_days: s.orderDays,
        cutoff_time: s.cutoff,
        delivery_mode: 'lead',
        lead_days: s.leadDays,
        lead_kind: s.leadKind,
        no_weekend_delivery: s.noWeekendDelivery,
        active: true,
      })
      if (error) throw error
    },
    async deleteSupplier(id: string): Promise<void> {
      const { error } = await client().from('suppliers').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    async saveCategory(c: CategoryInput): Promise<void> {
      const id = c.id ?? crypto.randomUUID()
      const { error } = await client().from('product_categories').upsert({
        id,
        site_id: c.siteId,
        name: c.name,
        position: c.position,
        active: true,
      })
      if (error) throw error
    },
    async deleteCategory(id: string): Promise<void> {
      const { error } = await client()
        .from('product_categories')
        .update({ active: false })
        .eq('id', id)
      if (error) throw error
    },
    async savePrepa(prepa: PrepaInput): Promise<void> {
      const { error } = await client().rpc('save_prep_template', {
        p_id: prepa.id ?? null,
        p_name: prepa.name,
        p_time_label: prepa.time,
        p_lines: prepa.lines.map((line) => ({
          product_id: line.productId,
          default_units: line.units,
        })),
      })
      if (error) throw error
    },
    async deletePrepa(id: string): Promise<void> {
      const { error } = await client().from('prep_templates').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    async saveSettings(settings: AppSettings): Promise<void> {
      const { data: profile, error: profileError } = await client()
        .from('profiles')
        .select('site_id')
        .single()
      if (profileError) throw profileError
      const { error } = await client().from('app_settings').upsert({
        site_id: profile.site_id,
        safety_deliveries: settings.safetyDeliveries,
        recalibration_threshold: settings.recalibrationThreshold,
      })
      if (error) throw error
    },
  },

  inventory: {
    async open(): Promise<string> {
      const { data, error } = await client().rpc('open_inventory')
      if (error) throw error
      return data as string
    },
    async listLines(countId: string): Promise<CountLine[]> {
      const { data, error } = await client()
        .from('stock_count_lines')
        .select('product_id, counted_units, theoretical_units, validated_by, validated_at')
        .eq('count_id', countId)
      if (error) throw error
      return (data ?? []).map((r) => ({
        productId: r.product_id as string,
        countedUnits: (r.counted_units as number) ?? 0,
        theoreticalUnits: (r.theoretical_units as number) ?? null,
        validatedBy: (r.validated_by as string) ?? null,
        validatedAt: (r.validated_at as string) ?? null,
      }))
    },
    async listPast(): Promise<InventoryRecord[]> {
      const { data, error } = await client()
        .from('stock_counts')
        .select('id, validated_at, validated_by')
        .eq('status', 'validated')
        .order('validated_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id as string,
        validatedAt: (r.validated_at as string) ?? null,
        validatedBy: (r.validated_by as string) ?? null,
      }))
    },
    async validateLine(countId: string, productId: string, countedUnits: number): Promise<void> {
      const { error } = await client().rpc('validate_count_line', {
        p_count: countId,
        p_product: productId,
        p_counted: countedUnits,
      })
      if (error) throw error
    },
    async finish(countId: string): Promise<void> {
      const { error } = await client().rpc('finish_inventory', { p_count: countId })
      if (error) throw error
    },
    async members(): Promise<Record<string, string>> {
      const { data, error } = await client().from('profiles').select('id, display_name')
      if (error) throw error
      const m: Record<string, string> = {}
      for (const p of data ?? []) m[p.id as string] = p.display_name as string
      return m
    },
    subscribe(countId: string, onChange: () => void): () => void {
      const sb = supabase
      if (!sb) return () => {}
      const ch = sb
        .channel(`inv-${countId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'point_chaud',
            table: 'stock_count_lines',
            filter: `count_id=eq.${countId}`,
          },
          () => onChange(),
        )
        .subscribe()
      return () => {
        void sb.removeChannel(ch)
      }
    },
  },
}
