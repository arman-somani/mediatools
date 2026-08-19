import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
export const AUDIO_API_URL = process.env.NEXT_PUBLIC_AUDIO_API_URL || API_BASE_URL;
export const VIDEO_API_URL = process.env.NEXT_PUBLIC_VIDEO_API_URL || API_BASE_URL;

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
export function audioApiUrl(path: string): string {
  return `${AUDIO_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
export function videoApiUrl(path: string): string {
  return `${VIDEO_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

const baseConfig = {
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420'
  },
  withCredentials: false,
};

export const api = axios.create({ baseURL: `${API_BASE_URL}/api`, ...baseConfig });
export const audioApi = axios.create({ baseURL: `${AUDIO_API_URL}/api`, ...baseConfig });
export const videoApi = axios.create({ baseURL: `${VIDEO_API_URL}/api`, ...baseConfig });

function applyInterceptors(axiosInstance: any) {
  // Attach token from localStorage
  axiosInstance.interceptors.request.use((config: any) => {
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
  axiosInstance.interceptors.response.use(
    (res: any) => res,
    async (error: any) => {
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
              return axiosInstance(original);
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
}

applyInterceptors(api);
applyInterceptors(audioApi);
applyInterceptors(videoApi);

export default api;
