import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { useAuth } from "../context/AuthContext";
import { fetchNewsPost, NewsPostDetail } from "../api/posts";
import { formatPostDate } from "../utils/date";
import "katex/dist/katex.min.css";

const NewsDetailPage = () => {
  const { slug } = useParams();
  const { token } = useAuth();
  const [post, setPost] = useState<NewsPostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchNewsPost(slug, token);
        if (mounted) {
          setPost(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError((err as Error).message || "无法加载该公告");
          setPost(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [slug, token]);

  if (!slug) {
    return <Navigate to="/news" replace />;
  }

  if (loading) {
    return (
      <article className="max-w-3xl mx-auto text-center py-20 text-slate-400">
        正在加载公告内容...
      </article>
    );
  }

  if (error) {
    return (
      <article className="max-w-3xl mx-auto text-center py-20 space-y-4">
        <p className="text-xl font-semibold text-slate-800">{error}</p>
        <Link to="/news" className="text-blue-600">
          ← 返回新闻列表
        </Link>
      </article>
    );
  }

  if (!post) {
    return <Navigate to="/news" replace />;
  }

  return (
    <article className="max-w-3xl mx-auto">
      <Link to="/news" className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline">
        ← 返回新闻列表
      </Link>
      <header className="mt-4">
        <p className="text-sm text-slate-500">{formatPostDate(post.date)}</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          {post.category && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-blue-700">
              {post.category}
            </span>
          )}
          {post.author && <span className="text-slate-500">作者：{post.author}</span>}
          {post.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">
              #{tag}
            </span>
          ))}
        </div>
      </header>
      <div className="mt-8 prose prose-slate max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
          {post.content}
        </ReactMarkdown>
      </div>
    </article>
  );
};

export default NewsDetailPage;
