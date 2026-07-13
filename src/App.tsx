import { Routes, Route } from 'react-router-dom'
import { Truck } from 'lucide-react'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { QuickExitPage } from '@/features/stock/QuickExitPage'
import { StockListPage } from '@/features/stock/StockListPage'
import { OrdersPage } from '@/features/orders/OrdersPage'
import { ComingSoon } from '@/components/ComingSoon'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/sortie" element={<QuickExitPage />} />
      <Route path="/stock" element={<StockListPage />} />
      <Route path="/commandes" element={<OrdersPage />} />
      <Route
        path="/receptions"
        element={
          <ComingSoon
            eyebrow="Réception"
            title="Réceptions"
            icon={Truck}
            phase="Phase 5"
            points={[
              '« Livraison conforme » en un geste, ou ajustement par ligne',
              'Seul l’accepté entre en stock (pas de reliquat)',
              'Note par ligne (« abîmé », « pas livré »…)',
              'Entrée en stock atomique, protégée contre le double-clic',
            ]}
          />
        }
      />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  )
}
