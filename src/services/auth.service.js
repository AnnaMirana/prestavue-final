const ADMIN_KEY = 'prestavue_admin_auth'
const CUSTOMER_ID_KEY = 'prestavue_customer_id'
const CUSTOMER_DATA_KEY = 'prestavue_customer_data'

const VALID_USERNAME = 'admin'
const VALID_PASSWORD = 'admin123'

export const AuthService = {
  login(username, password) {
    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      localStorage.setItem(ADMIN_KEY, btoa(`${username}:${Date.now()}`))
      return { success: true }
    }
    return { success: false, message: 'Identifiants incorrects' }
  },

  logout() {
    localStorage.removeItem(ADMIN_KEY)
  },

  logoutCustomer() {
    localStorage.removeItem(CUSTOMER_ID_KEY)
    localStorage.removeItem(CUSTOMER_DATA_KEY)
  },

  isAuthenticated() {
    return !!localStorage.getItem(ADMIN_KEY)
  },

  loginCustomer(customerId, customerData) {
    localStorage.setItem(CUSTOMER_ID_KEY, String(customerId))
    localStorage.setItem(CUSTOMER_DATA_KEY, JSON.stringify(customerData))
  },

  getCustomerId() {
    const id = localStorage.getItem(CUSTOMER_ID_KEY)
    return id === null ? null : Number.parseInt(id, 10)
  },

  getCustomerData() {
    const data = localStorage.getItem(CUSTOMER_DATA_KEY)
    return data ? JSON.parse(data) : null
  }
}
