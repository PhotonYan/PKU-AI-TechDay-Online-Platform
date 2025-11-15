import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface SubmissionListItem {
  id: number;
  sequence_no?: number | null;
  title: string;
  author: string;
  authors?: string | null;
  direction?: string | null;
  direction_id?: number | null;
  venue: string;
  status: string;
  track: string;
  award?: string | null;
  award_tags?: string[];
  award_badges?: { name: string; color?: string | null }[];
  paper_url?: string | null;
  poster_path?: string | null;
  archive_consent: boolean;
  vote_innovation?: number;
  vote_impact?: number;
  vote_feasibility?: number;
  year?: number | null;
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

const DEFAULT_BADGE_COLOR = "#fbbf24";

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  if (![3, 6].includes(normalized.length)) return null;
  const value = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const num = Number.parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((val) => {
      const clamped = Math.min(255, Math.max(0, val));
      return clamped.toString(16).padStart(2, "0");
    })
    .join("")}`;

const darkenHex = (hex: string, amount = 0.2) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return DEFAULT_BADGE_COLOR;
  const r = Math.floor(rgb.r * (1 - amount));
  const g = Math.floor(rgb.g * (1 - amount));
  const b = Math.floor(rgb.b * (1 - amount));
  return rgbToHex(r, g, b);
};

const getBadgeTextColor = (hex?: string) => {
  const rgb = hexToRgb(hex || DEFAULT_BADGE_COLOR);
  if (!rgb) return "#ffffff";
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  if (luminance < 200) {
    return "#ffffff";
  }
  return darkenHex(hex || DEFAULT_BADGE_COLOR, 0.4);
};

const currentYear = new Date().getFullYear();
const START_YEAR = 2024;
const fixedYears = Array.from({ length: Math.max(1, currentYear - START_YEAR + 1) }, (_, idx) => currentYear - idx);

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
  const [yearOptions] = useState<number[]>(fixedYears);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [exporting, setExporting] = useState(false);
  const canEditVotes = Boolean(user && (user.role === "admin" || user.role_template_can_edit_vote));

  const loadSubmissions = () => {
    const params = new URLSearchParams({ track });
    if (directionId !== "all") {
      params.append("direction_id", directionId);
    }
    if (selectedYear !== "all") {
      params.append("year", selectedYear);
    }
    if (sort) {
      params.append("sort", sort);
    }
    if (selectedYear !== "all") {
      params.append("year", selectedYear);
    }
    apiClient(`/api/submissions?${params.toString()}`)
      .then((data) => {
        const list = data.submissions as SubmissionListItem[];
        setSubmissions(list);
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
  }, [sort, track, directionId, selectedYear]);

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
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const yearPrefix = selectedYear === "all" ? "all" : selectedYear;
      const rawName = match?.[1] || `${yearPrefix}-${track}-export.csv`;
      const filename = rawName.replace(/[\r\n]/g, "").replace(/[\\/:*?"<>|]/g, "_").trim();
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
          <header>
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Table of works</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">成果展示</h1>
          <p className="mt-1 text-slate-600">
            本届科技节所有Poster、Demo列表与详细信息。
          </p>
          </header>
          <div className="my-8"></div>
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
            <div className="flex flex-wrap items-center gap-2">
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
              <select
                className="border rounded px-3 py-1 text-xs"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="all">全部年份</option>
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
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
              <div className="flex items-center justify-center w-12 font-semibold text-lg text-slate-700">
                {selectedYear === "all"
                  ? `${String(submission.year ?? "").slice(-2) || "--"}-${submission.sequence_no ?? "-"}`
                  : submission.sequence_no ?? "-"}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Link to={`/papers/${submission.id}`} className="font-semibold text-blue-700 hover:underline">
                    {submission.title}
                  </Link>
                  {(submission.award_badges || []).map((badge) => {
                    const badgeColor = badge.color || DEFAULT_BADGE_COLOR;
                    return (
                      <span
                        key={`${badge.name}-${badge.color || "default"}`}
                        className="text-xs border rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: badgeColor,
                          borderColor: badgeColor,
                          color: getBadgeTextColor(badgeColor),
                        }}
                      >
                        {badge.name}
                      </span>
                    );
                  })}
                </div>
                <div className="text-sm text-slate-600 flex flex-wrap gap-2">
                  <span>作者：{submission.authors || submission.author || "-"}</span>
                  <span>方向：{submission.direction || "未分类"}</span>
                  {submission.year && <span>年份：{submission.year}</span>}
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
