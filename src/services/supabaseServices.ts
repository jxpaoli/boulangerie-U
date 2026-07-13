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
  SupplierInput,
  CategoryInput,
} from '@/services/types'
import type { SupplierCalendar, Weekday } from '@/lib/orderCalendar'
import { toParisCivil, weekday } from '@/lib/orderCalendar'
import { WEEKDAYS_SHORT } from '@/lib/format'

function client() {
  if (!supabase) throw new Error('Supabase non configuré (voir .env.local)')
  return supabase
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
            `id, name, internal_ref, location_id, min_units, max_units,
             category:product_categories(id, name, position),
             supplier_products(supplier_id, supplier_ref, pack_size, order_unit),
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
        const sp = (row.supplier_products as Record<string, unknown>[] | null)?.[0]
        const cat = row.category as { id?: string; name?: string; position?: number } | null
        const fRows = row.forecast as unknown as Record<string, number>[] | null
        const f = fRows?.[0] ?? null
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
          stockUnits: balances[row.id as string] ?? 0,
          minUnits: (row.min_units as number) ?? 0,
          maxUnits: (row.max_units as number) ?? 0,
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
      const { data, error } = await client()
        .from('prep_templates')
        .select('id, name, time_label, prep_template_lines(product_id, default_units)')
        .eq('active', true)
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        time: (row.time_label as string) ?? '',
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
  },

  stock: {
    async balances(): Promise<Record<string, number>> {
      const { data, error } = await client().from('stock_balances').select('product_id, stock_units')
      if (error) throw error
      const out: Record<string, number> = {}
      for (const b of data ?? []) out[b.product_id as string] = (b.stock_units as number) ?? 0
      return out
    },

    async recordExit(batchId, lines: ExitLine[], note, force = false): Promise<void> {
      const { error } = await client().rpc('record_exit', {
        p_batch_id: batchId,
        p_lines: lines.map((l) => ({ product_id: l.productId, units: l.units })),
        p_note: note ?? null,
        p_force: force,
      })
      if (error) throw error
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
          min_order_packs: 1,
          order_multiple_packs: 1,
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
  },
}
