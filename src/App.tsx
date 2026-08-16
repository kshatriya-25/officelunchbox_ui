import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireStaff, SessionLoader } from './components/Guards'
import Layout from './components/Layout'
import AdminLayout from './pages/admin/AdminLayout'

import Login from './pages/Login'
import Register from './pages/Register'
import Menu from './pages/Menu'
import Checkout from './pages/Checkout'
import OrderTicket from './pages/OrderTicket'
import Orders from './pages/Orders'
import Profile from './pages/Profile'
import BulkOrders from './pages/BulkOrders'

import Dashboard from './pages/admin/Dashboard'
import AdminOrders from './pages/admin/AdminOrders'
import AdminMenu from './pages/admin/AdminMenu'
import DailyStock from './pages/admin/DailyStock'
import Vendors from './pages/admin/Vendors'
import WindowSettings from './pages/admin/WindowSettings'
import Payments from './pages/admin/Payments'
import Delivery from './pages/admin/Delivery'
import Locations from './pages/admin/Locations'
import Exports from './pages/admin/Exports'
import SettingsPage from './pages/admin/SettingsPage'

export default function App() {
  return (
    <SessionLoader>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Public: an office manager pricing a team lunch has no account yet. */}
        <Route path="/bulk-orders" element={<BulkOrders />} />

        {/* ── Customer ── */}
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/menu" replace />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:orderId" element={<OrderTicket />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* ── Kitchen hub ── */}
          <Route element={<RequireStaff />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="stock" element={<DailyStock />} />
              <Route path="payments" element={<Payments />} />
              <Route path="delivery" element={<Delivery />} />
              <Route path="exports" element={<Exports />} />

              {/* Pricing, catalogue and configuration stay admin-only. */}
              <Route element={<RequireAdmin />}>
                <Route path="menu" element={<AdminMenu />} />
                <Route path="vendors" element={<Vendors />} />
                <Route path="window" element={<WindowSettings />} />
                <Route path="locations" element={<Locations />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </SessionLoader>
  )
}
