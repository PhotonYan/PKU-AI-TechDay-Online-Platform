const defaultBase = import.meta.env.VITE_API_BASE || "";

type Options = {
  method?: string;
  body?: BodyInit | null;
  token?: string | null;
  headers?: Record<string, string>;
};

async function request(path: string, options: Options = {}) {
  const { method = "GET", body = null, token, headers = {} } = options;
  const res = await fetch(`${defaultBase}${path}`, {
    method,
    body,
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "请求失败");
  }
  if (res.status === 204) return null;
  return res.json();
}

type Client = typeof request & { baseURL: string };

const client = request as Client;
client.baseURL = defaultBase || window.location.origin;

export const apiClient = client;
