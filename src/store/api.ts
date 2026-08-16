import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from './baseQuery'
import type {
  AdminOrder,
  AdminOrderList,
  AppSettings,
  Category,
  DailyMenuRow,
  Dashboard,
  DeliveryPerson,
  Location,
  MenuItemAdmin,
  Order,
  OrderHistory,
  OrderWindow,
  Profile,
  PublicMenu,
  PublicSettings,
  TokenPair,
  Vendor,
  VendorExportSummary,
  VendorMessage,
  WindowState,
} from '../types'

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Profile',
    'Menu',
    'Window',
    'Orders',
    'AdminOrders',
    'Dashboard',
    'Vendors',
    'MenuItems',
    'DailyMenu',
    'Locations',
    'Settings',
    'Delivery',
    'Exports',
  ],
  endpoints: (builder) => ({
    // ── Auth ────────────────────────────────────────────────────────────────
    login: builder.mutation<TokenPair, { username: string; password: string }>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        // The backend uses OAuth2PasswordRequestForm, which needs form encoding.
        body: new URLSearchParams(credentials),
      }),
    }),

    register: builder.mutation<
      TokenPair,
      {
        name: string
        email: string
        password: string
        phone?: string
        default_location_id?: number
        default_drop_zone_id?: number
      }
    >({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),

    getProfile: builder.query<Profile, void>({
      query: () => '/auth/me',
      providesTags: ['Profile'],
    }),

    updateProfile: builder.mutation<Profile, Partial<Profile>>({
      query: (body) => ({ url: '/auth/me', method: 'PATCH', body }),
      invalidatesTags: ['Profile'],
    }),

    logout: builder.mutation<unknown, { refresh_token: string }>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', body }),
    }),

    // ── Public catalogue ────────────────────────────────────────────────────
    getMenu: builder.query<PublicMenu, string | void>({
      query: (serviceDate) => (serviceDate ? `/catalog/menu?service_date=${serviceDate}` : '/catalog/menu'),
      providesTags: ['Menu'],
    }),

    getWindow: builder.query<WindowState, void>({
      query: () => '/windows/current',
      providesTags: ['Window'],
    }),

    getLocations: builder.query<Location[], void>({
      query: () => '/locations',
      providesTags: ['Locations'],
    }),

    getPublicSettings: builder.query<PublicSettings, void>({
      query: () => '/settings/public',
      providesTags: ['Settings'],
    }),

    // ── Customer orders ─────────────────────────────────────────────────────
    placeOrder: builder.mutation<
      Order,
      {
        items: { menu_item_id: number; quantity: number }[]
        drop_zone_id?: number | null
        customer_note?: string
        upi_reference?: string
      }
    >({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      // Stock moved, so the menu and the day's numbers are both stale now.
      invalidatesTags: ['Orders', 'Menu', 'Dashboard', 'AdminOrders'],
    }),

    getMyOrders: builder.query<OrderHistory, { status?: string; limit?: number } | void>({
      query: (params) => {
        const search = new URLSearchParams()
        if (params?.status && params.status !== 'all') search.set('status', params.status)
        if (params?.limit) search.set('limit', String(params.limit))
        const qs = search.toString()
        return qs ? `/orders?${qs}` : '/orders'
      },
      providesTags: ['Orders'],
    }),

    getMyOrder: builder.query<Order, number>({
      query: (id) => `/orders/${id}`,
      providesTags: ['Orders'],
    }),

    submitPaymentReference: builder.mutation<Order, { id: number; upi_reference: string }>({
      query: ({ id, upi_reference }) => ({
        url: `/orders/${id}/payment-reference`,
        method: 'POST',
        body: { upi_reference },
      }),
      invalidatesTags: ['Orders', 'AdminOrders'],
    }),

    cancelMyOrder: builder.mutation<Order, { id: number; reason?: string }>({
      query: ({ id, reason }) => ({ url: `/orders/${id}/cancel`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Orders', 'Menu', 'Dashboard', 'AdminOrders'],
    }),

    // ── Admin: dashboard & orders ───────────────────────────────────────────
    getDashboard: builder.query<Dashboard, string | void>({
      query: (serviceDate) =>
        serviceDate ? `/admin/dashboard?service_date=${serviceDate}` : '/admin/dashboard',
      providesTags: ['Dashboard'],
    }),

    getAdminOrders: builder.query<AdminOrderList, Record<string, string | number | boolean | undefined>>({
      query: (params) => {
        const search = new URLSearchParams()
        Object.entries(params ?? {}).forEach(([key, value]) => {
          if (value !== undefined && value !== '' && value !== false) search.set(key, String(value))
        })
        const qs = search.toString()
        return qs ? `/admin/orders?${qs}` : '/admin/orders'
      },
      providesTags: ['AdminOrders'],
    }),

    getAdminOrder: builder.query<AdminOrder, number>({
      query: (id) => `/admin/orders/${id}`,
      providesTags: ['AdminOrders'],
    }),

    updateOrderStatus: builder.mutation<AdminOrder, { id: number; status: string; reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/orders/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: ['AdminOrders', 'Dashboard', 'Orders', 'Menu'],
    }),

    bulkUpdateStatus: builder.mutation<unknown, { order_ids: number[]; status: string }>({
      query: (body) => ({ url: '/admin/orders/bulk-status', method: 'POST', body }),
      invalidatesTags: ['AdminOrders', 'Dashboard'],
    }),

    reconcilePayment: builder.mutation<
      AdminOrder,
      { id: number; payment_status: string; upi_reference?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/admin/orders/${id}/payment`, method: 'POST', body }),
      invalidatesTags: ['AdminOrders', 'Dashboard', 'Orders'],
    }),

    // ── Admin: catalogue ────────────────────────────────────────────────────
    getVendors: builder.query<Vendor[], boolean | void>({
      query: (includeInactive) => `/catalog/vendors?include_inactive=${includeInactive ? 'true' : 'false'}`,
      providesTags: ['Vendors'],
    }),

    createVendor: builder.mutation<Vendor, Partial<Vendor>>({
      query: (body) => ({ url: '/catalog/vendors', method: 'POST', body }),
      invalidatesTags: ['Vendors'],
    }),

    updateVendor: builder.mutation<Vendor, { id: number } & Partial<Vendor>>({
      query: ({ id, ...body }) => ({ url: `/catalog/vendors/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Vendors', 'MenuItems'],
    }),

    getCategories: builder.query<Category[], void>({
      query: () => '/catalog/categories',
      providesTags: ['MenuItems'],
    }),

    createCategory: builder.mutation<Category, { name: string; sort_order?: number }>({
      query: (body) => ({ url: '/catalog/categories', method: 'POST', body }),
      invalidatesTags: ['MenuItems'],
    }),

    getMenuItems: builder.query<MenuItemAdmin[], { include_inactive?: boolean } | void>({
      query: (params) =>
        `/catalog/menu-items?include_inactive=${params?.include_inactive ? 'true' : 'false'}`,
      providesTags: ['MenuItems'],
    }),

    createMenuItem: builder.mutation<MenuItemAdmin, Record<string, unknown>>({
      query: (body) => ({ url: '/catalog/menu-items', method: 'POST', body }),
      invalidatesTags: ['MenuItems', 'Menu'],
    }),

    updateMenuItem: builder.mutation<MenuItemAdmin, { id: number } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/catalog/menu-items/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['MenuItems', 'Menu'],
    }),

    deleteMenuItem: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/catalog/menu-items/${id}`, method: 'DELETE' }),
      invalidatesTags: ['MenuItems', 'Menu'],
    }),

    uploadMenuItemImage: builder.mutation<MenuItemAdmin, { id: number; file: File }>({
      query: ({ id, file }) => {
        const form = new FormData()
        form.append('file', file)
        return { url: `/catalog/menu-items/${id}/image`, method: 'POST', body: form }
      },
      invalidatesTags: ['MenuItems', 'Menu'],
    }),

    // ── Admin: daily stock ──────────────────────────────────────────────────
    getDailyMenu: builder.query<DailyMenuRow[], string | void>({
      query: (serviceDate) =>
        serviceDate ? `/catalog/daily-menu?service_date=${serviceDate}` : '/catalog/daily-menu',
      providesTags: ['DailyMenu'],
    }),

    setDailyMenu: builder.mutation<
      DailyMenuRow[],
      {
        service_date?: string
        entries: {
          menu_item_id: number
          /** Omit or null for unlimited. */
          qty_total?: number | null
          is_available: boolean
          price_override?: string | null
        }[]
      }
    >({
      query: (body) => ({ url: '/catalog/daily-menu', method: 'PUT', body }),
      invalidatesTags: ['DailyMenu', 'Menu'],
    }),

    // ── Admin: window ───────────────────────────────────────────────────────
    upsertWindow: builder.mutation<
      OrderWindow,
      {
        service_date?: string
        opens_at: string
        cutoff_at: string
        delivery_eta?: string | null
        is_accepting?: boolean
        notes?: string | null
      }
    >({
      query: (body) => ({ url: '/windows', method: 'PUT', body }),
      invalidatesTags: ['Window', 'Menu', 'Dashboard'],
    }),

    toggleWindow: builder.mutation<OrderWindow, { is_accepting: boolean; service_date?: string }>({
      query: (body) => ({ url: '/windows/toggle', method: 'POST', body }),
      invalidatesTags: ['Window', 'Menu', 'Dashboard'],
    }),

    listWindows: builder.query<OrderWindow[], void>({
      query: () => '/windows',
      providesTags: ['Window'],
    }),

    // ── Admin: locations ────────────────────────────────────────────────────
    createLocation: builder.mutation<Location, { name: string; address?: string; city?: string }>({
      query: (body) => ({ url: '/locations', method: 'POST', body }),
      invalidatesTags: ['Locations'],
    }),

    createDropZone: builder.mutation<
      unknown,
      { location_id: number; name: string; description?: string }
    >({
      query: (body) => ({ url: '/locations/drop-zones', method: 'POST', body }),
      invalidatesTags: ['Locations'],
    }),

    deleteDropZone: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/locations/drop-zones/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Locations'],
    }),

    // ── Admin: settings ─────────────────────────────────────────────────────
    getSettings: builder.query<AppSettings, void>({
      query: () => '/settings',
      providesTags: ['Settings'],
    }),

    updateSettings: builder.mutation<AppSettings, Record<string, unknown>>({
      query: (body) => ({ url: '/settings', method: 'PATCH', body }),
      invalidatesTags: ['Settings', 'MenuItems', 'Menu'],
    }),

    uploadUpiQr: builder.mutation<AppSettings, File>({
      query: (file) => {
        const form = new FormData()
        form.append('file', file)
        return { url: '/settings/upi-qr', method: 'POST', body: form }
      },
      invalidatesTags: ['Settings'],
    }),

    // ── Admin: delivery ─────────────────────────────────────────────────────
    getDeliveryPersons: builder.query<DeliveryPerson[], void>({
      query: () => '/admin/delivery-persons',
      providesTags: ['Delivery'],
    }),

    createDeliveryPerson: builder.mutation<
      DeliveryPerson,
      { name: string; phone: string; vehicle_number?: string }
    >({
      query: (body) => ({ url: '/admin/delivery-persons', method: 'POST', body }),
      invalidatesTags: ['Delivery'],
    }),

    updateDeliveryPerson: builder.mutation<DeliveryPerson, { id: number } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/admin/delivery-persons/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Delivery'],
    }),

    assignDelivery: builder.mutation<
      unknown,
      { order_ids: number[]; delivery_person_id: number; notes?: string }
    >({
      query: (body) => ({ url: '/admin/delivery-persons/assign', method: 'POST', body }),
      invalidatesTags: ['Delivery', 'AdminOrders'],
    }),

    // ── Admin: exports ──────────────────────────────────────────────────────
    getVendorExportSummary: builder.query<VendorExportSummary, string | void>({
      query: (serviceDate) =>
        serviceDate ? `/admin/exports/vendors?service_date=${serviceDate}` : '/admin/exports/vendors',
      providesTags: ['Exports'],
    }),

    getVendorMessage: builder.query<VendorMessage, { vendorId: number; serviceDate: string }>({
      query: ({ vendorId, serviceDate }) =>
        `/admin/exports/vendors/${vendorId}/message?service_date=${serviceDate}`,
      providesTags: ['Exports'],
    }),
  }),
})

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useLogoutMutation,
  useGetMenuQuery,
  useGetWindowQuery,
  useGetLocationsQuery,
  useGetPublicSettingsQuery,
  usePlaceOrderMutation,
  useGetMyOrdersQuery,
  useGetMyOrderQuery,
  useSubmitPaymentReferenceMutation,
  useCancelMyOrderMutation,
  useGetDashboardQuery,
  useGetAdminOrdersQuery,
  useGetAdminOrderQuery,
  useUpdateOrderStatusMutation,
  useBulkUpdateStatusMutation,
  useReconcilePaymentMutation,
  useGetVendorsQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useGetMenuItemsQuery,
  useCreateMenuItemMutation,
  useUpdateMenuItemMutation,
  useDeleteMenuItemMutation,
  useUploadMenuItemImageMutation,
  useGetDailyMenuQuery,
  useSetDailyMenuMutation,
  useUpsertWindowMutation,
  useToggleWindowMutation,
  useListWindowsQuery,
  useCreateLocationMutation,
  useCreateDropZoneMutation,
  useDeleteDropZoneMutation,
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useUploadUpiQrMutation,
  useGetDeliveryPersonsQuery,
  useCreateDeliveryPersonMutation,
  useUpdateDeliveryPersonMutation,
  useAssignDeliveryMutation,
  useGetVendorExportSummaryQuery,
  useLazyGetVendorMessageQuery,
} = api
