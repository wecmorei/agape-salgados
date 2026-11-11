import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './store'
import { AdminPage } from './pages/AdminPage'
import { MenuPage } from './pages/MenuPage'
import { PontoPage } from './ponto/PontoPage'

const basename =
  import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')

function MenuShell() {
  return (
    <StoreProvider>
      <Outlet />
    </StoreProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/ponto" element={<PontoPage />} />
        <Route element={<MenuShell />}>
          <Route path="/" element={<MenuPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
