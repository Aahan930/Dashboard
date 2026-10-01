import axios from 'axios'
const api = axios.create({ baseURL: '/' })

export function errMsg(e, fallback = 'Something went wrong') {
  try {
    const raw = e.response?.data?._server_messages
    if (raw) {
      return JSON.parse(raw)
        .map((m) => JSON.parse(m).message)
        .join(' ')
        .replace(/<[^>]*>/g, '')
    }
  } catch {}
  return e.response?.data?.message || fallback
}

export async function loadRoles() {
  const uid = localStorage.getItem('user')
  const { data } = await api.get('/api/method/frappe.core.doctype.user.user.get_roles', {
    params: { uid },
  })
  const roles = data.message || []
  localStorage.setItem('roles', JSON.stringify(roles))
  return roles
}

function roles() {
  try {
    return JSON.parse(localStorage.getItem('roles') || '[]')
  } catch {
    return []
  }
}

export function isManager() {
  return roles().includes('Leave Approver')
}
export function isHR() {
  const r = roles()

  // A user classified as a manager should not
  // receive HR-only navigation.
  if (r.includes('Leave Approver')) {
    return false
  }

  return (
    r.includes('HR User') ||
    r.includes('HR Manager') ||
    r.includes('System Manager')
  )
}


export default api