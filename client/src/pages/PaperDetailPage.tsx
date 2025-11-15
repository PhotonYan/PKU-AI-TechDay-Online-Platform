import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface VoteLog {
  id: number;
  field_name: string;
  old_value?: number;
  new_value?: number;
  created_at: string;
  user_name?: string | null;
}

interface PaperDetail {
  id: number;
  sequence_no?: number | null;
  title: string;
  author?: string | null;
  authors?: string | null;
  year?: number | null;
  abstract: string;
  direction?: string | null;
  direction_id?: number | null;
  contact: string;
  venue: string;
  track: string;
  status: string;
  publication_status: string;
  archive_consent: boolean;
  paper_url?: string | null;
  poster_path?: string | null;
  award?: string | null;
  award_tags?: string[];
  award_badges?: { name: string; color?: string | null }[];
  showVotes: boolean;
  canViewLogs: boolean;
  vote_innovation?: number;
  vote_impact?: number;
  vote_feasibility?: number;
  logs?: VoteLog[];
}

const fieldLabels: Record<string, string> = {
  vote_innovation: "最佳创意奖",
  vote_impact: "最受欢迎奖",
  vote_feasibility: "不明觉厉奖",
};

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

const PaperDetailPage = () => {
  const { id } = useParams();
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    apiClient(`/api/submissions/${id}`, { token: token || undefined })
      .then((data) => {
        if (!mounted) return;
        setPaper(data as PaperDetail);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError((err as Error).message);
        setPaper(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id, token]);

  if (loading) {
    return <div className="text-center text-slate-500 py-10">加载中...</div>;
  }

  if (error) {
    return (
      <div className="text-center text-red-600 py-10">
        {error}
      </div>
    );
  }

  if (!paper) return null;

  const rawPosterSrc = paper.poster_path || null;
  const withToken = rawPosterSrc && token ? `${rawPosterSrc}${rawPosterSrc.includes("?") ? "&" : "?"}token=${token}` : rawPosterSrc;
  const posterSrc = withToken
    ? `${withToken}${withToken.includes("#") ? "&" : "#"}toolbar=0&navpanes=0&scrollbar=0&view=FitH&zoom=page-fit`
    : null;

  return (
    <div className="bg-white p-6 rounded shadow space-y-4">
      <div>
        <div className="flex items-center gap-3 text-slate-500 text-sm mb-1">
          <div className="font-bold text-lg text-slate-700">{paper.sequence_no ?? "-"}</div>
          <div>编号</div>
        </div>
        <h1 className="text-2xl font-semibold mb-2">{paper.title}</h1>
        <div className="text-sm text-slate-600 flex flex-wrap gap-3">
          <span>作者：{paper.authors || paper.author || "-"}</span>
          <span>方向：{paper.direction || "未分类"}</span>
          {paper.year && <span>年份：{paper.year}</span>}
          <span>Track：{paper.track === "poster" ? "Poster" : "Demo"}</span>
          {paper.award_badges && paper.award_badges.length > 0 && (
            <span className="flex flex-wrap gap-1 text-amber-600">
              奖项：
              {paper.award_badges.map((badge) => (
                <span
                  key={`${badge.name}-${badge.color || "default"}`}
                  className="border rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: badge.color || DEFAULT_BADGE_COLOR,
                    borderColor: badge.color || DEFAULT_BADGE_COLOR,
                    color: getBadgeTextColor(badge.color || DEFAULT_BADGE_COLOR),
                  }}
                >
                  {badge.name}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-1 flex gap-3">
          <span>审核状态：{paper.status === "approved" ? "通过" : paper.status === "pending" ? "待审核" : "未通过"}</span>
          <span>投稿状态：{paper.publication_status === "published" ? "已发表" : "中稿"}</span>
          <span className="text-slate-400">Archive：{paper.archive_consent ? "已授权" : "未授权"}</span>
        </div>
      </div>
      <div>
        <h2 className="font-semibold mb-1">摘要</h2>
        <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{paper.abstract}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="bg-slate-50 p-3 rounded">
          <div className="font-medium">作者联系方式</div>
          <div>{paper.contact}</div>
        </div>
        <div className="bg-slate-50 p-3 rounded">
          <div className="font-medium">期刊/会议</div>
          <div>{paper.venue}</div>
        </div>
        <div className="bg-slate-50 p-3 rounded">
          <div className="font-medium">Paper URL</div>
          {paper.paper_url ? (
            <a className="text-blue-600" href={paper.paper_url} target="_blank" rel="noreferrer">
              {paper.paper_url}
            </a>
          ) : (
            <div>未填写</div>
          )}
        </div>
      </div>
      {posterSrc && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-600">Poster 预览</div>
          <div className="border rounded overflow-hidden bg-slate-50">
            <iframe title="poster" src={posterSrc} className="w-full h-[600px]" />
          </div>
        </div>
      )}
      {paper.showVotes && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            ["最佳创意奖", paper.vote_innovation],
            ["最受欢迎奖", paper.vote_impact],
            ["不明觉厉奖", paper.vote_feasibility],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-slate-50 p-3 rounded border">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-xl font-semibold text-slate-800">{value ?? "-"}</div>
            </div>
          ))}
        </div>
      )}
      {paper.canViewLogs && (
        <div>
          <h2 className="font-semibold mb-2">修改历史</h2>
          <div className="space-y-2 text-sm">
            {paper.logs && paper.logs.length > 0 ? (
              paper.logs.map((log) => (
                <div key={log.id} className="border rounded px-3 py-2 bg-slate-50">
                  <div className="text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString()} · {log.user_name || "未知用户"}
                  </div>
                  <div>
                    {fieldLabels[log.field_name] || log.field_name}: {log.old_value ?? "-"} → {log.new_value ?? "-"}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-sm">暂无修改记录</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperDetailPage;
