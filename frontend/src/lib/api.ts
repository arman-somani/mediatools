import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420'
  },
  withCredentials: false,
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('mediatools-auth');
    if (stored) {
      try {
        const { state } = JSON.parse(stored);
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      } catch {}
    }
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const stored = localStorage.getItem('mediatools-auth');
        if (stored) {
          const { state } = JSON.parse(stored);
          if (state?.refreshToken) {
            const { data } = await axios.post(apiUrl('/api/auth/refresh'), {
              refreshToken: state.refreshToken,
            });
            const newToken = data.data.accessToken;
            const parsed = JSON.parse(stored);
            parsed.state.accessToken = newToken;
            localStorage.setItem('mediatools-auth', JSON.stringify(parsed));
            original.headers.Authorization = `Bearer ${newToken}`;
            return api(original);
          }
        }
      } catch {
        localStorage.removeItem('mediatools-auth');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
