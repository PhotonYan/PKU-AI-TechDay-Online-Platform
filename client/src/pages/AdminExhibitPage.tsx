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
  authors?: string | null;
  venue: string;
  status: string;
  track: string;
  publication_status: string;
  award?: string | null;
  year?: number | null;
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

const currentYear = new Date().getFullYear();
const START_YEAR = 2024;
const fixedYears = Array.from({ length: Math.max(1, currentYear - START_YEAR + 1) }, (_, idx) => currentYear - idx);

const AdminExhibitPage = () => {
  const { token } = useAuth();
  const [track, setTrack] = useState("poster");
  const [rows, setRows] = useState<AdminSubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [yearOptions] = useState<number[]>(fixedYears);

  const loadRows = () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (track) params.set("track", track);
    if (yearFilter !== "all") params.set("year", yearFilter);
    apiClient(`/api/admin/submissions?${params.toString()}`, { token })
      .then((data) => {
        const list = data as AdminSubmissionRow[];
        setRows(list);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRows();
  }, [token, track, yearFilter]);

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
      const params = new URLSearchParams({ track });
      if (yearFilter !== "all") {
        params.set("year", yearFilter);
      }
      await apiClient(`/api/admin/submissions/renumber?${params.toString()}`, { method: "POST", token });
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
          <select className="border rounded px-3 py-2" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="all">全部年份</option>
            {yearOptions.map((year) => (
              <option key={year} value={String(year)}>
                {year}
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
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col className="w-1/12" />
            <col className="w-2/5" />
            <col className="w-1/6" />
            <col className="w-1/6" />
            <col className="w-1/7" />
            <col className="w-1/12" />
            <col className="w-40" />
          </colgroup>
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-4 py-2"></th>
              {[
                "标题",
                "方向",
                "作者",
              ].map((header) => (
                <th key={header} className="px-4 py-2">
                  {header}
                </th>
              ))}
              <th className="px-4 py-2 whitespace-nowrap">接受会议/期刊</th>
              <th className="px-4 py-2 min-w-[6rem]">状态</th>
              <th className="px-4 py-2 whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const inReview = row.status === "pending" || editingId === row.id;
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 text-slate-500 font-semibold text-center">
                    {yearFilter === "all"
                      ? `${String(row.year ?? "").slice(-2) || "--"}-${row.sequence_no ?? "-"}`
                      : row.sequence_no ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">
                      <Link className="text-blue-600 hover:underline" to={`/papers/${row.id}`} target="_blank">
                        {row.title}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                      <span>{trackOptions.find((opt) => opt.key === row.track)?.label}</span>
                      {row.year && <span>年份：{row.year}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{row.direction || "未分类"}</td>
                  <td className="px-4 py-3">{row.authors || row.author || "-"}</td>
                  <td className="px-4 py-3">{row.venue}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        row.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : row.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusLabels[row.status] || row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-2 whitespace-nowrap">
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
