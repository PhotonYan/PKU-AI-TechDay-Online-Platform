import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deleteNewsPost, fetchManagePosts, NewsPostSummary, publishNewsPost } from "../api/posts";
import { formatPostDate } from "../utils/date";

const VISIBILITY_LABELS: Record<string, string> = {
  public: "所有访客",
  authenticated: "登录用户",
  volunteer: "志愿者",
  author: "作者",
  reviewer: "审阅者",
  admin: "管理员"
};

const NewsManagementPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<NewsPostSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canPublish = useMemo(() => Boolean(user && (user.role === "admin" || user.can_publish_news)), [user]);

  useEffect(() => {
    if (!token || !canPublish) return;
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchManagePosts(token);
        if (mounted) {
          setPosts(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError((err as Error).message || "加载失败");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [token, canPublish]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!canPublish) {
    return (
      <article className="max-w-3xl mx-auto text-center py-20 space-y-4">
        <p className="text-xl font-semibold text-slate-800">您没有访问新闻管理的权限</p>
        <Link to="/news" className="text-blue-600">
          ← 返回新闻列表
        </Link>
      </article>
    );
  }

  const togglePublish = async (post: NewsPostSummary) => {
    if (!token) return;
    try {
      await publishNewsPost(post.slug, !post.published, token);
      setPosts((prev) => prev.map((item) => (item.slug === post.slug ? { ...item, published: !post.published } : item)));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (post: NewsPostSummary) => {
    if (!token) return;
    if (!window.confirm(`确认删除《${post.title}》？该操作无法撤销。`)) return;
    try {
      await deleteNewsPost(post.slug, token);
      setPosts((prev) => prev.filter((item) => item.slug !== post.slug));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">Newsroom</p>
          <h1 className="text-3xl font-bold text-slate-900">新闻管理</h1>
        </div>
        <div className="flex gap-3">
          <Link
            to="/news/editor/new"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            创建新闻
          </Link>
          <Link
            to="/news"
            className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            查看前台
          </Link>
        </div>
      </header>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">标题</th>
              <th className="px-4 py-3 text-left">作者</th>
              <th className="px-4 py-3 text-left">日期</th>
              <th className="px-4 py-3 text-left">可见范围</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={6}>
                  正在加载...
                </td>
              </tr>
            )}
            {!loading && posts.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={6}>
                  暂无新闻
                </td>
              </tr>
            )}
            {posts.map((post) => (
              <tr key={post.slug} className="border-t">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left text-blue-600 hover:underline"
                    onClick={() => navigate(`/news/editor/${post.slug}`)}
                  >
                    {post.title}
                  </button>
                </td>
                <td className="px-4 py-3">{post.author || "-"}</td>
                <td className="px-4 py-3">{formatPostDate(post.date)}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {(post.visibility && post.visibility.length > 0
                    ? post.visibility
                    : ["public"]
                  )
                    .map((value) => VISIBILITY_LABELS[value] || value)
                    .join("、")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      post.published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {post.published ? "已发布" : "草稿"}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-3 text-xs">
                  <button className="text-blue-600" type="button" onClick={() => togglePublish(post)}>
                    {post.published ? "撤回" : "发布"}
                  </button>
                  <button className="text-red-600" type="button" onClick={() => handleDelete(post)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default NewsManagementPage;
