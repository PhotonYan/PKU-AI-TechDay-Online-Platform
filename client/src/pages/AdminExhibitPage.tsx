import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface AdminSubmissionRow {
  id: number;
  sequence_no?: number | null;
  title: string;
  direction?: string | null;
  author?: string | null;
  venue: string;
  status: string;
  track: string;
  publication_status: string;
  award?: string | null;
}

const trackOptions = [
  { key: "poster", label: "Poster Track" },
  { key: "demo", label: "Demo Track" },
];

const statusLabels: Record<string, string> = {
  pending: "待审核",
  approved: "通过",
  rejected: "未通过",
};

const AdminExhibitPage = () => {
  const { token } = useAuth();
  const [track, setTrack] = useState("poster");
  const [rows, setRows] = useState<AdminSubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadRows = () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiClient(`/api/admin/submissions?track=${track}`, { token })
      .then((data) => setRows(data as AdminSubmissionRow[]))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRows();
  }, [token, track]);

  useEffect(() => {
    if (!info) return;
    const timer = setTimeout(() => setInfo(null), 2000);
    return () => clearTimeout(timer);
  }, [info]);

  const reviewSubmission = async (id: number, status: "approved" | "rejected") => {
    if (!token) return;
    try {
      await apiClient(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ review_status: status }),
      });
      setEditingId(null);
      setInfo(status === "approved" ? "已通过审核" : "已拒绝该投稿");
      loadRows();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteSubmission = async (id: number) => {
    if (!token) return;
    if (!window.confirm("确认删除该投稿？")) return;
    try {
      await apiClient(`/api/admin/submissions/${id}`, { method: "DELETE", token });
      setEditingId((prev) => (prev === id ? null : prev));
      setInfo("投稿已删除");
      loadRows();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const renumber = async () => {
    if (!token) return;
    try {
      await apiClient(`/api/admin/submissions/renumber?track=${track}`, { method: "POST", token });
      setInfo("序号已重新生成");
      loadRows();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">参展管理</h1>
        <div className="flex items-center gap-2">
          <select className="border rounded px-3 py-2" value={track} onChange={(e) => setTrack(e.target.value)}>
            {trackOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="px-3 py-2 border rounded text-sm" type="button" onClick={renumber}>
            重新编号
          </button>
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}
      {info && <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">{info}</div>}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              {[
                "标题",
                "方向",
                "作者",
                "接受会议/期刊",
                "状态",
                "操作",
              ].map((header) => (
                <th key={header} className="px-4 py-2">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const inReview = row.status === "pending" || editingId === row.id;
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 flex items-center gap-2">
                      <span className="text-slate-400 text-sm">{row.sequence_no ?? "-"}</span>
                      <Link className="text-blue-600 hover:underline" to={`/papers/${row.id}`} target="_blank">
                        {row.title}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500">
                      {trackOptions.find((opt) => opt.key === row.track)?.label}
                    </div>
                  </td>
                  <td className="px-4 py-3">{row.direction || "未分类"}</td>
                  <td className="px-4 py-3">{row.author || "-"}</td>
                  <td className="px-4 py-3">{row.venue}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                      {statusLabels[row.status] || row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    {inReview ? (
                      <>
                        <button
                          className="px-3 py-1 bg-emerald-600 text-white rounded text-xs"
                          onClick={() => reviewSubmission(row.id, "approved")}
                        >
                          通过
                        </button>
                        <button
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs"
                          onClick={() => reviewSubmission(row.id, "rejected")}
                        >
                          未通过
                        </button>
                        <button
                          className="px-3 py-1 border border-red-400 text-red-600 rounded text-xs"
                          onClick={() => deleteSubmission(row.id)}
                        >
                          删除
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="text-blue-600 text-xs" onClick={() => setEditingId(row.id)}>
                          修改
                        </button>
                        <button className="text-red-600 text-xs" onClick={() => deleteSubmission(row.id)}>
                          删除
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                  暂无投稿
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                  加载中...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminExhibitPage;
