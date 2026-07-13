import { Routes, Route } from 'react-router-dom'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { QuickExitPage } from '@/features/stock/QuickExitPage'
import { StockListPage } from '@/features/stock/StockListPage'
import { OrdersPage } from '@/features/orders/OrdersPage'
import { ReceptionsPage } from '@/features/deliveries/ReceptionsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/sortie" element={<QuickExitPage />} />
      <Route path="/stock" element={<StockListPage />} />
      <Route path="/commandes" element={<OrdersPage />} />
      <Route path="/receptions" element={<ReceptionsPage />} />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  )
}
