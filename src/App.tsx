import { Routes, Route } from 'react-router-dom'
import { ClipboardList, Truck } from 'lucide-react'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { QuickExitPage } from '@/features/stock/QuickExitPage'
import { StockListPage } from '@/features/stock/StockListPage'
import { ComingSoon } from '@/components/ComingSoon'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/sortie" element={<QuickExitPage />} />
      <Route path="/stock" element={<StockListPage />} />
      <Route
        path="/commandes"
        element={
          <ComingSoon
            eyebrow="Commande"
            title="Commandes"
            icon={ClipboardList}
            phase="Phase 4"
            points={[
              'Proposition automatique : couverture jusqu’à la prochaine livraison',
              'Plafond congélo pris en compte, arrondi au carton expliqué',
              'Contrôle visuel rapide (cartons pleins + carton entamé)',
              'Note par ligne, validation, export bon de commande pour l’appel',
            ]}
          />
        }
      />
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
