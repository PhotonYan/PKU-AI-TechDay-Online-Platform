import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchPublicPosts, NewsPostSummary } from "../api/posts";
import { formatPostDate } from "../utils/date";

const NewsListPage = () => {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<NewsPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canPublish = Boolean(user && (user.role === "admin" || user.can_publish_news));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchPublicPosts(token);
        if (mounted) {
          setPosts(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError((err as Error).message || "新闻加载失败");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((post) => {
      if (post.category) set.add(post.category);
    });
    return Array.from(set);
  }, [posts]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((post) => {
      post.tags.forEach((tag) => set.add(tag));
    });
    return Array.from(set);
  }, [posts]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  useEffect(() => {
    setSelectedCategory("all");
    setSelectedTag("all");
  }, [token]);

  const filteredPosts = posts.filter((post) => {
    const categoryOk = selectedCategory === "all" || post.category === selectedCategory;
    const tagOk = selectedTag === "all" || post.tags.includes(selectedTag);
    return categoryOk && tagOk;
  });

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Newsroom</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">新闻公告</h1>
            <p className="mt-1 text-slate-600">
              关注科技节动态、志愿者通知及重要时间节点，随时了解最新安排。
            </p>
          </div>
          {canPublish && (
            <div className="flex flex-wrap gap-3">
              <Link
                to="/news/editor/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                创建新闻
              </Link>
              <Link
                to="/news/manage"
                className="inline-flex items-center rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700"
              >
                管理新闻
              </Link>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            分类：
            <select
              className="rounded border px-3 py-1 text-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">全部</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            标签：
            <select className="rounded border px-3 py-1 text-sm" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
              <option value="all">全部</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="space-y-4">
        {loading && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-400">
            正在加载新闻...
          </div>
        )}
        {!loading && filteredPosts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-400">
            暂无新闻公告。
          </div>
        )}
        {filteredPosts.map((post) => (
          <article
            key={post.slug}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-blue-200 transition"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <span>{formatPostDate(post.date)}</span>
              {post.category && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
                  <span className="text-blue-600 font-semibold">{post.category}</span>
                </>
              )}
            </div>
            <Link
              to={`/news/${post.slug}`}
              className="mt-2 block text-2xl font-semibold text-slate-900 hover:text-blue-600"
            >
              {post.title}
            </Link>
            <p className="mt-3 text-slate-600 leading-relaxed">{post.summary}</p>
            {post.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                {post.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default NewsListPage;
