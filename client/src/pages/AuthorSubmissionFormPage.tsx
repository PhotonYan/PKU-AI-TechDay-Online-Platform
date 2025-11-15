import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface DirectionOption {
  id: number;
  name: string;
}

const trackOptions = [
  { key: "poster", label: "Poster Track" },
  { key: "demo", label: "Demo Track" },
];

const publicationOptions = [
  { key: "accepted", label: "中稿" },
  { key: "published", label: "已发表" },
];

const defaultForm = {
  title: "",
  abstract: "",
  contact: "",
  venue: "",
  authors: "",
  track: "poster",
  direction_id: "",
  publication_status: "accepted",
  archive_consent: true,
  paper_url: "",
};

type FormShape = typeof defaultForm;

const AuthorSubmissionFormPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<FormShape>(defaultForm);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [existingPoster, setExistingPoster] = useState<string | null>(null);
  const [directions, setDirections] = useState<DirectionOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const resolveApiUrl = (path: string) => (path.startsWith("http") ? path : `${apiClient.baseURL}${path}`);

  useEffect(() => {
    apiClient("/api/directions")
      .then((data) => {
        const list = data as DirectionOption[];
        setDirections(list);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (directions.length > 0 && !form.direction_id) {
      setForm((prev) => ({ ...prev, direction_id: String(directions[0].id) }));
    }
  }, [directions]);

  useEffect(() => {
    if (!token || !isEdit || !id) return;
    apiClient(`/api/authors/submissions/${id}`, { token })
      .then((data: any) => {
        setForm({
          title: data.title,
          abstract: data.abstract,
          contact: data.contact,
          venue: data.venue,
          authors: data.authors || "",
          track: data.track,
          direction_id: data.direction_id ? String(data.direction_id) : "",
          publication_status: data.publication_status,
          archive_consent: Boolean(data.archive_consent),
          paper_url: data.paper_url || "",
        });
        setExistingPoster(data.poster_path || null);
      })
      .catch((err) => setError(err.message));
  }, [token, id, isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.direction_id) {
      setError("请选择投稿方向");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "direction_id" && !value) return;
        if (key === "archive_consent") {
          payload.append(key, value ? "true" : "false");
          return;
        }
        payload.append(key, value as string);
      });
      if (posterFile) {
        payload.append("poster", posterFile);
      }
      const url = isEdit ? `/api/authors/submissions/${id}` : "/api/authors/submissions";
      await apiClient(url, { method: isEdit ? "PUT" : "POST", body: payload, token });
      setMessage("提交成功");
      setTimeout(() => navigate("/author/profile"), 800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPoster = async () => {
    if (!token || !existingPoster) return;
    try {
      const posterUrl = existingPoster.includes("token=")
        ? existingPoster
        : `${existingPoster}${existingPoster.includes("?") ? "&" : "?"}token=${token}`;
      const res = await fetch(resolveApiUrl(posterUrl), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error("无法获取已上传的 Poster");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || "poster.pdf";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{isEdit ? "编辑投稿" : "上传投稿"}</h1>
        <p className="text-sm text-slate-500 mt-1">请填写完整信息，方便评审与展示。</p>
      </div>
      {message && <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">论文标题</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">接受会议 / 期刊</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">作者（多位请用逗号分隔）</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              value={form.authors}
              onChange={(e) => setForm({ ...form, authors: e.target.value })}
              placeholder="Author A, Author B, ..."
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">联系方式</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Paper URL（可选）</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              value={form.paper_url}
              onChange={(e) => setForm({ ...form, paper_url: e.target.value })}
              placeholder="https://"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">摘要</label>
          <textarea
            className="mt-1 border rounded px-3 py-2 w-full h-32"
            value={form.abstract}
            onChange={(e) => setForm({ ...form, abstract: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Track</label>
            <select
              className="mt-1 border rounded px-3 py-2 w-full"
              value={form.track}
              onChange={(e) => setForm({ ...form, track: e.target.value })}
            >
              {trackOptions.map((option) => (
                <option value={option.key} key={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">投稿状态</label>
            <select
              className="mt-1 border rounded px-3 py-2 w-full"
              value={form.publication_status}
              onChange={(e) => setForm({ ...form, publication_status: e.target.value })}
            >
              {publicationOptions.map((option) => (
                <option value={option.key} key={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">方向</label>
            <select
              className="mt-1 border rounded px-3 py-2 w-full"
              value={form.direction_id}
              onChange={(e) => setForm({ ...form, direction_id: e.target.value })}
              required
            >
              <option value="" disabled>
                请选择方向
              </option>
              {directions.map((direction) => (
                <option key={direction.id} value={direction.id}>
                  {direction.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">PDF Poster（可选）</label>
            <input type="file" accept="application/pdf" className="mt-1 block w-full text-sm" onChange={(e) => setPosterFile(e.target.files?.[0] || null)} />
            {existingPoster && !posterFile && (
              <button type="button" className="text-xs text-blue-600" onClick={downloadPoster}>
                下载已上传文件
              </button>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.archive_consent}
            onChange={(e) => setForm({ ...form, archive_consent: e.target.checked })}
          />
          是否同意科技节结束后进入 Archive
        </label>
        <div className="flex gap-3">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60" disabled={submitting}>
            {submitting ? "提交中..." : "保存"}
          </button>
          <button type="button" className="px-4 py-2 border rounded" onClick={() => navigate("/author/profile")}>取消</button>
        </div>
      </form>
    </div>
  );
};

export default AuthorSubmissionFormPage;
