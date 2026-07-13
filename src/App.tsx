import { Routes, Route } from 'react-router-dom'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { QuickExitPage } from '@/features/stock/QuickExitPage'
import { StockListPage } from '@/features/stock/StockListPage'
import { InventoryPage } from '@/features/stock/InventoryPage'
import { OrdersPage } from '@/features/orders/OrdersPage'
import { ReceptionsPage } from '@/features/deliveries/ReceptionsPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { useAuth } from '@/features/auth/AuthProvider'
import { ParametresPage } from '@/features/admin/ParametresPage'
import { ProductsAdmin } from '@/features/admin/ProductsAdmin'
import { SuppliersAdmin } from '@/features/admin/SuppliersAdmin'
import { CategoriesAdmin } from '@/features/admin/CategoriesAdmin'
import { InventoryHistory } from '@/features/admin/InventoryHistory'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[13px] text-ink-3">
        Chargement…
      </div>
    )
  }
  if (!user) return <LoginPage />

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/sortie" element={<QuickExitPage />} />
      <Route path="/stock" element={<StockListPage />} />
      <Route path="/inventaire" element={<InventoryPage />} />
      <Route path="/commandes" element={<OrdersPage />} />
      <Route path="/receptions" element={<ReceptionsPage />} />
      <Route path="/parametres" element={<ParametresPage />} />
      <Route path="/parametres/produits" element={<ProductsAdmin />} />
      <Route path="/parametres/fournisseurs" element={<SuppliersAdmin />} />
      <Route path="/parametres/familles" element={<CategoriesAdmin />} />
      <Route path="/parametres/inventaires" element={<InventoryHistory />} />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  )
}
