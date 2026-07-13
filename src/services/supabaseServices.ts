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
             category:product_categories(name, position),
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
        const cat = row.category as { name?: string; position?: number } | null
        const fRows = row.forecast as unknown as Record<string, number>[] | null
        const f = fRows?.[0] ?? null
        return {
          id: row.id as string,
          name: row.name as string,
          category: cat?.name ?? 'Autres',
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
}
