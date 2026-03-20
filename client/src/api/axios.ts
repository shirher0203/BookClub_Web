import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? '/api' : 'http://localhost:3000/api');

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});
