import { apiClient } from "./client";

export type PostVisibility = "public" | "authenticated" | "volunteer" | "author" | "reviewer" | "admin";

export interface NewsPostSummary {
  slug: string;
  title: string;
  date: string;
  category?: string | null;
  summary?: string | null;
  tags: string[];
  visibility: PostVisibility[];
  author?: string | null;
  author_id?: number | null;
  published: boolean;
}

export interface NewsPostDetail extends NewsPostSummary {
  content: string;
}

export interface NewsPostPayload {
  title: string;
  date: string;
  category?: string | null;
  summary?: string | null;
  tags?: string[];
  visibility?: PostVisibility[];
  content: string;
}

export const fetchPublicPosts = (token?: string | null) =>
  apiClient("/api/posts", { token: token || undefined }) as Promise<NewsPostSummary[]>;

export const fetchManagePosts = (token: string) =>
  apiClient("/api/posts/manage", { token }) as Promise<NewsPostSummary[]>;

export const fetchNewsPost = (slug: string, token?: string | null) =>
  apiClient(`/api/posts/${slug}`, { token: token || undefined }) as Promise<NewsPostDetail>;

export const createNewsPost = (payload: NewsPostPayload, token: string) =>
  apiClient("/api/posts", { method: "POST", token, body: JSON.stringify(payload) }) as Promise<NewsPostDetail>;

export const updateNewsPost = (slug: string, payload: NewsPostPayload, token: string) =>
  apiClient(`/api/posts/${slug}`, { method: "PUT", token, body: JSON.stringify(payload) }) as Promise<NewsPostDetail>;

export const deleteNewsPost = (slug: string, token: string) =>
  apiClient(`/api/posts/${slug}`, { method: "DELETE", token });

export const publishNewsPost = (slug: string, published: boolean, token: string) =>
  apiClient(`/api/posts/${slug}/publish`, {
    method: "POST",
    token,
    body: JSON.stringify({ published })
  }) as Promise<NewsPostSummary>;
