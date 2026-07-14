/**
 * Point d'entrée des services : choisit l'implémentation selon la source de données.
 * Les écrans importent `services` d'ici — jamais Supabase ni le mock directement.
 */
import { dataSource } from '@/lib/supabase'
import { mockServices } from '@/services/mock'
import { supabaseServices } from '@/services/supabaseServices'
import type { DataServices } from '@/services/types'

export const services: DataServices = dataSource === 'supabase' ? supabaseServices : mockServices

export type {
  Product,
  Supplier,
  Prepa,
  PrepaInput,
  ExitLine,
  CountLine,
  InventoryRecord,
  PurchaseOrder,
  PurchaseOrderLine,
  PlaceOrderInput,
  DataServices,
} from '@/services/types'
