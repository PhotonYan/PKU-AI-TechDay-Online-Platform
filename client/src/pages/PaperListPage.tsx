import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface SubmissionListItem {
  id: number;
  title: string;
  author: string;
  direction?: string | null;
  direction_id?: number | null;
  venue: string;
  status: string;
  track: string;
  award?: string | null;
  paper_url?: string | null;
  poster_path?: string | null;
  archive_consent: boolean;
  vote_innovation?: number;
  vote_impact?: number;
  vote_feasibility?: number;
}

interface DirectionOption {
  id: number;
  name: string;
}

const voteFields = [
  { key: "vote_innovation", label: "最佳创意" },
  { key: "vote_impact", label: "最受欢迎" },
  { key: "vote_feasibility", label: "不明觉厉" },
] as const;

const PaperListPage = () => {
  const { token, user } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [showVotes, setShowVotes] = useState(false);
  const [canSort, setCanSort] = useState(false);
  const [sort, setSort] = useState<string>("");
  const [voteInputs, setVoteInputs] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [track, setTrack] = useState("poster");
  const [directionId, setDirectionId] = useState("all");
  const [directions, setDirections] = useState<DirectionOption[]>([]);
  const [exporting, setExporting] = useState(false);
  const canEditVotes = Boolean(user && (user.role === "admin" || user.role_template_can_edit_vote));

  const loadSubmissions = () => {
    const params = new URLSearchParams({ track });
    if (directionId !== "all") {
      params.append("direction_id", directionId);
    }
    if (sort) {
      params.append("sort", sort);
    }
    apiClient(`/api/submissions?${params.toString()}`)
      .then((data) => {
        setSubmissions(data.submissions);
        setShowVotes(data.showVotes);
        setCanSort(data.canSort);
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    apiClient("/api/directions")
      .then((data) => setDirections(data as DirectionOption[]))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [sort, track, directionId]);

  const handleVoteInputChange = (paperId: number, value: string) => {
    setVoteInputs((prev) => ({ ...prev, [paperId]: value }));
  };

  const submitVotes = async (submission: SubmissionListItem, e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage("请先登录");
      return;
    }
    const raw = voteInputs[submission.id] || "";
    const parts = raw.split(/[\/,\s]+/).filter(Boolean);
    if (parts.length !== 3) {
      setMessage("请输入“创/欢/不”格式，例如 9.5/8.8/7");
      return;
    }
    const [innovation, impact, feasibility] = parts.map((p) => Number(p));
    if (parts.some((p) => Number.isNaN(Number(p)))) {
      setMessage("请输入数字");
      return;
    }
    setSavingId(submission.id);
    setMessage(null);
    try {
      await apiClient(`/api/submissions/${submission.id}/votes`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          vote_innovation: innovation,
          vote_impact: impact,
          vote_feasibility: feasibility,
        }),
      });
      setMessage("投票数据已更新");
      setVoteInputs((prev) => ({ ...prev, [submission.id]: "" }));
      loadSubmissions();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const exportCsv = async () => {
    if (!token || user?.role !== "admin") return;
    setExporting(true);
    const params = new URLSearchParams({ track });
    if (directionId !== "all") {
      params.append("direction_id", directionId);
    }
    try {
      const res = await fetch(`${apiClient.baseURL}/api/submissions/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("导出失败");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?(.*)"?/i);
      const filename = match?.[1] || `${track}-export.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">成果展示</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {["poster", "demo"].map((key) => (
              <button
                key={key}
                type="button"
                className={`px-3 py-1 rounded border text-xs ${track === key ? "bg-blue-600 text-white border-blue-600" : "bg-white"}`}
                onClick={() => setTrack(key)}
              >
                {key === "poster" ? "Poster Track" : "Demo Track"}
              </button>
            ))}
            <select
              className="border rounded px-3 py-1 text-xs"
              value={directionId}
              onChange={(e) => setDirectionId(e.target.value)}
            >
              <option value="all">全部方向</option>
              {directions.map((direction) => (
                <option key={direction.id} value={direction.id}>
                  {direction.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showVotes && canSort && (
            <select className="border rounded px-3 py-2" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="">默认排序</option>
              {voteFields.map((field) => (
                <option key={field.key} value={field.key}>
                  按{field.label}投票降序
                </option>
              ))}
            </select>
          )}
          {user?.role === "admin" && (
            <button className="px-3 py-2 border rounded text-sm" onClick={exportCsv} disabled={exporting}>
              {exporting ? "导出中..." : "导出当前列表"}
            </button>
          )}
        </div>
      </div>
      {message && <div className="mb-3 text-sm text-blue-600">{message}</div>}
      <div className="bg-white shadow rounded divide-y">
        {submissions.map((submission) => (
          <div key={submission.id} className="px-4 py-3 hover:bg-slate-50">
            <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Link to={`/papers/${submission.id}`} className="font-semibold text-blue-700 hover:underline">
                    {submission.title}
                  </Link>
                  {submission.award && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{submission.award}</span>
                  )}
                </div>
                <div className="text-sm text-slate-600">
                  作者：{submission.author} · 方向：{submission.direction || "未分类"}
                </div>
                <div className="text-xs text-slate-400">{submission.venue}</div>
              </div>
              {showVotes && (
                <div className="mt-2 md:mt-0 flex flex-col items-end text-sm text-slate-600">
                  {voteFields.map((field) => (
                    <div key={field.key}>
                      {field.label}: {(submission as any)[field.key] ?? "-"}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {showVotes && (
              <>
                {canEditVotes && (
                <form className="flex items-center gap-2 text-xs justify-end" onSubmit={(e) => submitVotes(submission, e)}>
                  <input
                    className="border rounded px-2 py-1 text-sm w-40"
                    placeholder="创/欢/不"
                    value={voteInputs[submission.id] ?? ""}
                    onChange={(e) => handleVoteInputChange(submission.id, e.target.value)}
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 border rounded text-sm"
                    disabled={savingId === submission.id}
                  >
                    {savingId === submission.id ? "保存中..." : "保存"}
                  </button>
                </form>
                )}
              </>
            )}
          </div>
        ))}
        {submissions.length === 0 && <div className="p-4 text-center text-slate-500">暂无数据</div>}
      </div>
    </div>
  );
};

export default PaperListPage;
