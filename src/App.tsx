import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const QuickExitPage = lazy(() => import('@/features/stock/QuickExitPage').then((m) => ({ default: m.QuickExitPage })))
const StockListPage = lazy(() => import('@/features/stock/StockListPage').then((m) => ({ default: m.StockListPage })))
const InventoryPage = lazy(() => import('@/features/stock/InventoryPage').then((m) => ({ default: m.InventoryPage })))
const OrdersPage = lazy(() => import('@/features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const ReceptionsPage = lazy(() => import('@/features/deliveries/ReceptionsPage').then((m) => ({ default: m.ReceptionsPage })))
const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const ParametresPage = lazy(() => import('@/features/admin/ParametresPage').then((m) => ({ default: m.ParametresPage })))
const ProductsAdmin = lazy(() => import('@/features/admin/ProductsAdmin').then((m) => ({ default: m.ProductsAdmin })))
const SuppliersAdmin = lazy(() => import('@/features/admin/SuppliersAdmin').then((m) => ({ default: m.SuppliersAdmin })))
const CategoriesAdmin = lazy(() => import('@/features/admin/CategoriesAdmin').then((m) => ({ default: m.CategoriesAdmin })))
const InventoryHistory = lazy(() => import('@/features/admin/InventoryHistory').then((m) => ({ default: m.InventoryHistory })))
const ScheduledExitsAdmin = lazy(() => import('@/features/admin/ScheduledExitsAdmin').then((m) => ({ default: m.ScheduledExitsAdmin })))
const OrderSettingsAdmin = lazy(() => import('@/features/admin/OrderSettingsAdmin').then((m) => ({ default: m.OrderSettingsAdmin })))

function ResponsableOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return user?.role === 'responsable' ? children : <Navigate to="/" replace />
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[13px] text-ink-3">
        Chargement…
      </div>
    )
  }
  if (!user) return <Suspense fallback={<Loading />}><LoginPage /></Suspense>

  return (
    <Suspense fallback={<Loading />}><Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/sortie" element={<QuickExitPage />} />
      <Route path="/stock" element={<StockListPage />} />
      <Route path="/inventaire" element={<InventoryPage />} />
      <Route path="/commandes" element={<OrdersPage />} />
      <Route path="/receptions" element={<ReceptionsPage />} />
      <Route path="/parametres" element={<ParametresPage />} />
      <Route path="/parametres/produits" element={<ResponsableOnly><ProductsAdmin /></ResponsableOnly>} />
      <Route path="/parametres/fournisseurs" element={<ResponsableOnly><SuppliersAdmin /></ResponsableOnly>} />
      <Route path="/parametres/familles" element={<ResponsableOnly><CategoriesAdmin /></ResponsableOnly>} />
      <Route path="/parametres/inventaires" element={<ResponsableOnly><InventoryHistory /></ResponsableOnly>} />
      <Route path="/parametres/sorties-programmees" element={<ResponsableOnly><ScheduledExitsAdmin /></ResponsableOnly>} />
      <Route path="/parametres/calcul-commandes" element={<ResponsableOnly><OrderSettingsAdmin /></ResponsableOnly>} />
      <Route path="*" element={<DashboardPage />} />
    </Routes></Suspense>
  )
}

function Loading() {
  return <div className="flex min-h-dvh items-center justify-center text-[13px] text-ink-3">Chargement…</div>
}
