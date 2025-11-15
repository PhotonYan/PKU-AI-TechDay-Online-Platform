import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { useAuth } from "../context/AuthContext";
import { createNewsPost, fetchNewsPost, NewsPostPayload, PostVisibility, updateNewsPost } from "../api/posts";
import "katex/dist/katex.min.css";

const VISIBILITY_OPTIONS: { value: PostVisibility; label: string }[] = [
  { value: "public", label: "所有访客" },
  { value: "authenticated", label: "登录用户" },
  { value: "volunteer", label: "志愿者" },
  { value: "author", label: "作者" },
  { value: "reviewer", label: "审阅者" },
  { value: "admin", label: "管理员" }
];

const defaultDate = () => new Date().toISOString().split("T")[0];

const VISIBILITY_ORDER: PostVisibility[] = VISIBILITY_OPTIONS.map((opt) => opt.value);

const NewsEditorPage = () => {
  const { slug } = useParams();
  const isEdit = Boolean(slug);
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const canPublish = Boolean(user && (user.role === "admin" || user.can_publish_news));
  const applyVisibilityRules = (values: PostVisibility[]) => {
    let result = Array.from(new Set(values));
    if (result.includes("public")) {
      return [...VISIBILITY_ORDER];
    }
    if (result.includes("authenticated")) {
      const authenticatedSet: PostVisibility[] = ["authenticated", "volunteer", "author", "reviewer", "admin"];
      result = Array.from(new Set([...result, ...authenticatedSet]));
    }
    return result;
  };

  const normalizeVisibilitySelection = (values?: PostVisibility[]) =>
    applyVisibilityRules(values && values.length ? values : ["public"]);

  const [form, setForm] = useState({
    title: "",
    date: defaultDate(),
    category: "",
    summary: "",
    tagsInput: "",
    visibility: normalizeVisibilitySelection(),
    content: ""
  });
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicSelected = form.visibility.includes("public");
  const authenticatedSelected = !publicSelected && form.visibility.includes("authenticated");

  useEffect(() => {
    if (!isEdit || !slug || !token) return;
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchNewsPost(slug, token);
        if (!mounted) return;
        setForm({
          title: data.title,
          date: data.date,
          category: data.category || "",
          summary: data.summary || "",
          tagsInput: data.tags.join(", "),
          visibility: normalizeVisibilitySelection(data.visibility as PostVisibility[]),
          content: data.content
        });
        setPublished(data.published);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError((err as Error).message || "加载文章失败");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [isEdit, slug, token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!canPublish) {
    return (
      <article className="max-w-3xl mx-auto text-center py-20 space-y-4">
        <p className="text-xl font-semibold text-slate-800">您没有新闻发布权限</p>
        <Link to="/news" className="text-blue-600">
          ← 返回新闻列表
        </Link>
      </article>
    );
  }

  const updateField = (key: keyof typeof form, value: string | PostVisibility[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleVisibility = (value: PostVisibility, checked: boolean) => {
    setForm((prev) => {
      let next = prev.visibility;
      if (checked) {
        next = [...next, value];
      } else {
        next = next.filter((item) => item !== value);
      }
      next = applyVisibilityRules(next);
      if (next.length === 0) {
        next = ["public"];
      }
      return { ...prev, visibility: next };
    });
  };

  const handleSave = async () => {
    if (!token) return;
    if (!form.title.trim()) {
      alert("请输入标题");
      return;
    }
    if (!form.content.trim()) {
      alert("请输入正文内容");
      return;
    }
    setSaving(true);
    try {
      const payload: NewsPostPayload = {
        title: form.title.trim(),
        date: form.date || defaultDate(),
        category: form.category.trim() || undefined,
        summary: form.summary.trim() || undefined,
        tags: form.tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        visibility: form.visibility.length ? form.visibility : ["public"],
        content: form.content
      };
      const result = isEdit && slug ? await updateNewsPost(slug, payload, token) : await createNewsPost(payload, token);
      setPublished(result.published);
      if (!isEdit) {
        navigate(`/news/editor/${result.slug}`, { replace: true });
      } else {
        alert("已保存草稿");
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">{isEdit ? "编辑新闻" : "新建新闻"}</p>
          <h1 className="text-3xl font-bold text-slate-900">{form.title || "未命名新闻"}</h1>
          {isEdit && (
            <p className="text-xs text-slate-500">
              当前状态：{published ? "已发布" : "草稿"}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Link
            to="/news/manage"
            className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            返回管理
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存草稿"}
          </button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-400">
          正在加载文章...
        </div>
      ) : (
        <>
          <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-slate-600">
              标题
              <input
                className="mt-1 rounded border px-3 py-2"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="请输入标题"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-600">
              日期
              <input
                type="date"
                className="mt-1 rounded border px-3 py-2"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-600">
              分类
              <input
                className="mt-1 rounded border px-3 py-2"
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                placeholder="公告 / 新闻 / 通知"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-600">
              标签
              <input
                className="mt-1 rounded border px-3 py-2"
                value={form.tagsInput}
                onChange={(e) => updateField("tagsInput", e.target.value)}
                placeholder="tag1, tag2"
              />
            </label>
            <label className="md:col-span-2 flex flex-col text-sm font-medium text-slate-600">
              摘要
              <textarea
                className="mt-1 rounded border px-3 py-2"
                value={form.summary}
                onChange={(e) => updateField("summary", e.target.value)}
                placeholder="不填将自动截取正文"
              />
            </label>
            <div className="md:col-span-2">
              <div className="text-sm font-medium text-slate-600">可见范围</div>
              <div className="mt-2 flex flex-wrap gap-3">
                {VISIBILITY_OPTIONS.map((option) => {
                  const checked = form.visibility.includes(option.value);
                  const autoDisabled =
                    (publicSelected && option.value !== "public") ||
                    (authenticatedSelected && !["public", "authenticated"].includes(option.value));
                  return (
                    <label
                      key={option.value}
                      className={`inline-flex items-center gap-2 text-sm ${
                        autoDisabled ? "text-slate-400 cursor-not-allowed" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={autoDisabled}
                        onChange={(e) => toggleVisibility(option.value, e.target.checked)}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col">
              <div className="mb-2 text-sm font-semibold text-slate-600">Markdown 编辑</div>
              <textarea
                className="flex-1 rounded border px-3 py-2 font-mono text-sm leading-6"
                value={form.content}
                onChange={(e) => updateField("content", e.target.value)}
                placeholder="在此输入 Markdown 内容..."
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 text-sm font-semibold text-slate-600">实时预览</div>
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                  {form.content || "预览区域"}
                </ReactMarkdown>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default NewsEditorPage;
