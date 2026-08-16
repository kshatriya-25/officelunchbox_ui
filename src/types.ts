// Shapes returned by the FastAPI backend. Money arrives as a decimal string
// (never a float) so nothing is lost in transit; format it with formatMoney.

export type FoodType = 'VEG' | 'NON_VEG' | 'EGG'
export type MarkupType = 'DEFAULT' | 'PERCENT' | 'FLAT'

export type OrderStatus =
  | 'CONFIRMED'
  | 'PREPARING'
  | 'PACKED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED'

export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'
export type Role = 'admin' | 'ops' | 'customer'

export interface Profile {
  id: number
  name: string
  username: string
  email: string
  phone: string | null
  role: Role
  is_active: boolean
  employee_code: string | null
  default_location_id: number | null
  default_location_name: string | null
  default_drop_zone_id: number | null
  default_drop_zone_name: string | null
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  user?: Profile
}

export interface WindowState {
  has_window: boolean
  is_open: boolean
  reason: string | null
  is_accepting?: boolean
  service_date: string
  opens_at: string | null
  cutoff_at: string | null
  delivery_eta: string | null
  seconds_to_open: number | null
  seconds_to_cutoff: number | null
  notes?: string | null
}

export interface Category {
  id: number
  name: string
  slug: string
  sort_order: number
  is_active: boolean
}

export interface PublicMenuItem {
  id: number
  name: string
  description: string | null
  image_path: string | null
  food_type: FoodType
  calories: number | null
  category_id: number
  category_slug: string
  price: string
  /** null when unlimited — never render this as 0. */
  qty_remaining: number | null
  is_unlimited: boolean
  is_sold_out: boolean
}

export interface PublicMenu {
  service_date: string
  window: WindowState
  categories: Category[]
  items: PublicMenuItem[]
}

export interface DropZone {
  id: number
  location_id: number
  name: string
  description: string | null
  is_active: boolean
}

export interface Location {
  id: number
  name: string
  address: string | null
  city: string | null
  is_active: boolean
  drop_zones: DropZone[]
}

export interface PublicSettings {
  gst_percent: string
  delivery_fee: string
  upi_id: string | null
  upi_payee_name: string | null
  upi_qr_path: string | null
  support_contact: string | null
  support_note: string | null
  currency_symbol: string
}

export interface OrderItem {
  id: number
  menu_item_id: number | null
  item_name: string
  food_type: FoodType | null
  quantity: number
  unit_price: string
  line_total: string
}

export interface Order {
  id: number
  token: string
  service_date: string
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: string
  upi_reference: string | null
  location_id: number
  location_name: string | null
  drop_zone_id: number
  drop_zone_name: string | null
  drop_zone_description: string | null
  delivery_eta: string | null
  subtotal: string
  delivery_fee: string
  gst_percent: string
  gst_amount: string
  total: string
  customer_note: string | null
  placed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  items: OrderItem[]
  item_summary: string | null
}

export interface OrderHistory {
  orders: Order[]
  total_count: number
  total_spent: string
}

// ── Admin ───────────────────────────────────────────────────────────────────

export interface AdminOrderItem extends OrderItem {
  vendor_id: number | null
  vendor_name: string | null
  unit_vendor_price: string
  line_vendor_total: string
}

export interface AdminOrder extends Omit<Order, 'items'> {
  user_id: number
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  employee_code: string | null
  vendor_cost_total: string
  margin_total: string
  paid_at: string | null
  delivery_person_id: number | null
  delivery_person_name: string | null
  assignment_status: string | null
  items: AdminOrderItem[]
}

export interface AdminOrderList {
  orders: AdminOrder[]
  total_count: number
  page: number
  page_size: number
}

export interface PortionTallyRow {
  menu_item_id: number | null
  item_name: string
  vendor_name: string | null
  total_qty: number
}

export interface Dashboard {
  service_date: string
  window: WindowState
  total_orders: number
  unpaid_orders: number
  unpaid_amount: string
  pending_preparation: number
  delivered_orders: number
  cancelled_orders: number
  gross_revenue: string
  vendor_cost: string
  margin: string
  delivery_revenue: string
  status_counts: Record<string, number>
  portion_tally: PortionTallyRow[]
}

export interface Vendor {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  gst_number: string | null
  notes: string | null
  is_active: boolean
}

export interface MenuItemAdmin {
  id: number
  name: string
  description: string | null
  image_path: string | null
  food_type: FoodType
  calories: number | null
  vendor_id: number
  vendor_name: string | null
  category_id: number
  category_name: string | null
  vendor_price: string
  markup_type: MarkupType
  markup_value: string | null
  selling_price: string
  margin: string | null
  is_active: boolean
}

export interface DailyMenuRow {
  id: number
  service_date: string
  menu_item_id: number
  menu_item_name: string | null
  /** null means unlimited. */
  qty_total: number | null
  qty_sold: number
  qty_remaining: number | null
  is_unlimited: boolean
  is_sold_out: boolean
  price_override: string | null
  is_available: boolean
}

export interface DeliveryPerson {
  id: number
  name: string
  phone: string
  vehicle_number: string | null
  is_active: boolean
  notes: string | null
  active_orders: number
}

export interface AppSettings {
  default_markup_percent: string
  gst_percent: string
  delivery_fee: string
  upi_id: string | null
  upi_payee_name: string | null
  upi_qr_path: string | null
  support_contact: string | null
  support_note: string | null
}

export interface OrderWindow {
  id: number
  service_date: string
  opens_at: string
  cutoff_at: string
  delivery_eta: string | null
  is_accepting: boolean
  notes: string | null
}

export interface VendorExportLine {
  item_name: string
  quantity: number
  unit_vendor_price: string
  amount: string
}

export interface VendorExportRow {
  vendor_id: number
  vendor_name: string | null
  contact_person: string | null
  phone: string | null
  item_count: number
  total_qty: number
  amount_payable: string
  last_sent_at: string | null
  items: VendorExportLine[]
}

export interface VendorExportSummary {
  service_date: string
  generated_at: string
  order_count: number
  vendors: VendorExportRow[]
}

export interface VendorMessage {
  text: string
  phone: string | null
  whatsapp_url: string | null
  total_qty: number
  amount_payable: string
  item_count: number
}
