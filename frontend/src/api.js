const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8010`;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export const api = {
  base: API_BASE,
  lookups: () => request("/api/lookups"),
  login: (data) => request("/api/login", { method: "POST", body: JSON.stringify(data) }),
  dashboard: (params = {}) => request(`/api/dashboard?${new URLSearchParams(clean(params))}`),
  hiccups: (params = {}) => request(`/api/hiccups?${new URLSearchParams(clean(params))}`),
  hiccup: (id) => request(`/api/hiccups/${id}`),
  createHiccup: (data) => request("/api/hiccups", { method: "POST", body: JSON.stringify(data) }),
  updateHiccup: (id, data) => request(`/api/hiccups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  addComment: (id, data) => request(`/api/hiccups/${id}/comments`, { method: "POST", body: JSON.stringify(data) }),
  addDepartment: (name) => request("/api/departments", { method: "POST", body: JSON.stringify({ name }) }),
  addUser: (data) => request("/api/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  resetUserPassword: (id, data) => request(`/api/users/${id}/reset-password`, { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id, adminUserId) => request(`/api/users/${id}?${new URLSearchParams({ admin_user_id: adminUserId })}`, { method: "DELETE" }),
  updateProfile: (id, data) => request(`/api/users/${id}/profile`, { method: "PATCH", body: JSON.stringify(data) }),
  uploadAttachment: async (id, userId, file) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${API_BASE}/api/hiccups/${id}/attachments?user_id=${userId}`, { method: "POST", body });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  summary: (params = {}) => request(`/api/monthly-summary?${new URLSearchParams(clean(params))}`),
  email: (params = {}) => request(`/api/monthly-summary/email?${new URLSearchParams(clean(params))}`),
  exportUrl: (path) => `${API_BASE}${path}`,
};

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== "" && value != null));
}
