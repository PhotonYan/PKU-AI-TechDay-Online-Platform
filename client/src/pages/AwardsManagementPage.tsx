import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Direction {
  id: number;
  name: string;
}

interface AwardDefinition {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
}

interface Recommendation {
  reviewer_id: number;
  reviewer_name: string;
  reason: string;
  confidence?: number | null;
  updated_at: string;
}

interface AwardSubmission {
  id: number;
  sequence_no?: number | null;
  title: string;
  direction?: string | null;
  direction_id?: number | null;
  author?: string | null;
  authors?: string | null;
  year?: number | null;
  award_tags: string[];
  award_badges: { name: string; color?: string | null }[];
  reviewer_tags: Recommendation[];
  my_recommendation?: Recommendation | null;
}

const DEFAULT_BADGE_COLOR = "#fbbf24";
const badgeClass =
  "inline-flex items-center text-xs border rounded-full px-2 py-0.5 mr-1 mb-1 bg-amber-50 border-amber-200 text-amber-700";

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const normalized = hex.replace("#", "");
  if (![3, 6].includes(normalized.length)) return null;
  const value = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const num = Number.parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((val) => {
      const clamped = Math.min(255, Math.max(0, val));
      return clamped.toString(16).padStart(2, "0");
    })
    .join("")}`;

const darkenHex = (hex: string, amount = 0.2): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return DEFAULT_BADGE_COLOR;
  const r = Math.floor(rgb.r * (1 - amount));
  const g = Math.floor(rgb.g * (1 - amount));
  const b = Math.floor(rgb.b * (1 - amount));
  return rgbToHex(r, g, b);
};

const getBadgeTextColor = (hex?: string): string => {
  const rgb = hexToRgb(hex || DEFAULT_BADGE_COLOR);
  if (!rgb) return "#fff";
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  if (luminance < 200) {
    return "#ffffff";
  }
  return darkenHex(hex || DEFAULT_BADGE_COLOR, 0.4);
};

const AwardsManagementPage = () => {
  const { token, user } = useAuth();
  const trackOptions = [
    { key: "poster", label: "Poster Track" },
    { key: "demo", label: "Demo Track" },
  ];
  const [directions, setDirections] = useState<Direction[]>([]);
  const [awardDefs, setAwardDefs] = useState<AwardDefinition[]>([]);
  const [submissions, setSubmissions] = useState<AwardSubmission[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [directionFilters, setDirectionFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"sequence" | "id">("sequence");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [track, setTrack] = useState<"poster" | "demo">("poster");
  const [yearFilter, setYearFilter] = useState("all");
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [recommendationTarget, setRecommendationTarget] = useState<AwardSubmission | null>(null);
  const [awardTarget, setAwardTarget] = useState<AwardSubmission | null>(null);
  const [detailTarget, setDetailTarget] = useState<Recommendation[] | null>(null);

  const isReviewer = user?.role === "reviewer";
  const reviewerDirection = user?.reviewer_direction_id ? String(user.reviewer_direction_id) : "";

  useEffect(() => {
    apiClient("/api/directions")
      .then((data) => setDirections(data as Direction[]))
      .catch(() => setDirections([]));
  }, []);

  useEffect(() => {
    if (!token) return;
    apiClient("/api/awards", { token })
      .then((data) => setAwardDefs(data as AwardDefinition[]))
      .catch(() => setAwardDefs([]));
  }, [token]);

  useEffect(() => {
    if (isReviewer && reviewerDirection) {
      setDirectionFilters([reviewerDirection]);
    }
  }, [isReviewer, reviewerDirection]);

  useEffect(() => {
    if (!token) return;
    loadSubmissions();
  }, [token, statusFilters, directionFilters, sortBy, sortOrder, user?.role, track, yearFilter]);

  useEffect(() => {
    if (!info) return;
    const timer = setTimeout(() => setInfo(null), 2000);
    return () => clearTimeout(timer);
  }, [info]);

  const loadSubmissions = () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (user?.role === "admin" && directionFilters.length > 0) {
      params.set("direction_ids", directionFilters.join(","));
    }
    if (statusFilters.length > 0) {
      params.set("status", statusFilters.join(","));
    }
    params.set("sort_by", sortBy);
    params.set("sort_order", sortOrder);
    params.set("track", track);
    if (yearFilter !== "all") {
      params.set("year", yearFilter);
    }
    apiClient(`/api/awards/submissions?${params.toString()}`, { token })
      .then((data) => {
        const list = data as AwardSubmission[];
        setSubmissions(list);
        if (yearFilter === "all") {
          const years = Array.from(new Set(list.map((item) => item.year).filter(Boolean))) as number[];
          years.sort((a, b) => b - a);
          setYearOptions(years);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const toggleStatus = (value: string) => {
    setStatusFilters((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const toggleDirection = (value: string) => {
    if (isReviewer) return;
    setDirectionFilters((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const statusOptions = useMemo(
    () => [
      { value: "none", label: "无标签" },
      { value: "recommended", label: "推荐" },
      ...awardDefs.map((award) => ({ value: award.name, label: award.name })),
    ],
    [awardDefs]
  );

  const handleRecommendationSaved = (message: string) => {
    setInfo(message);
    setRecommendationTarget(null);
    loadSubmissions();
  };

  const handleAwardSaved = (message: string) => {
    setInfo(message);
    setAwardTarget(null);
    loadSubmissions();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">奖项管理</h1>
          <p className="text-sm text-slate-500">
            仅展示已通过审核的论文。{isReviewer ? "您只能查看注册时所选的方向。" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {trackOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`px-3 py-1 border rounded text-sm ${
                track === option.key ? "bg-blue-600 text-white border-blue-600" : ""
              }`}
              onClick={() => setTrack(option.key as "poster" | "demo")}
            >
              {option.label}
            </button>
          ))}
          <select
            className="border rounded px-3 py-2 text-sm"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="all">全部年份</option>
            {yearOptions.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "sequence" | "id")}
          >
            <option value="sequence">按序号</option>
            <option value="id">按投稿编号</option>
          </select>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          >
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded shadow p-4">
          <div className="text-sm font-semibold mb-2">按状态筛选</div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`px-3 py-1 border rounded text-xs ${
                  statusFilters.includes(option.value) ? "bg-blue-600 text-white border-blue-600" : ""
                }`}
                onClick={() => toggleStatus(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded shadow p-4">
          <div className="text-sm font-semibold mb-2">按方向筛选</div>
          {isReviewer ? (
            <div className="text-sm text-slate-600">
              审阅方向：
              {directions.find((direction) => String(direction.id) === reviewerDirection)?.name || "未设置"}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {directions.map((direction) => (
                <button
                  key={direction.id}
                  type="button"
                  className={`px-3 py-1 border rounded text-xs ${
                    directionFilters.includes(String(direction.id)) ? "bg-blue-600 text-white border-blue-600" : ""
                  }`}
                  onClick={() => toggleDirection(String(direction.id))}
                >
                  {direction.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}
      {info && <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">{info}</div>}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-4 py-2 w-16">序号</th>
              <th className="px-4 py-2">标题</th>
              <th className="px-4 py-2 w-20">年份</th>
              <th className="px-4 py-2 w-32">作者</th>
              <th className="px-4 py-2 w-32">方向</th>
              <th className="px-4 py-2 w-48">奖项 / 标签</th>
              <th className="px-4 py-2 w-32">推荐</th>
              <th className="px-4 py-2 w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr key={submission.id} className="border-t">
                <td className="px-4 py-3 text-center">{submission.sequence_no ?? "-"}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800">
                    <Link className="text-blue-600 hover:underline" to={`/papers/${submission.id}`} target="_blank">
                      {submission.title}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3">{submission.year || "-"}</td>
                <td className="px-4 py-3">{submission.authors || submission.author || "-"}</td>
                <td className="px-4 py-3">{submission.direction || "-"}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const awardBadges = submission.award_badges || [];
                    const hasRecommendation = submission.award_tags?.includes("推荐");
                    return (
                      <div className="flex flex-wrap">
                        {awardBadges.map((badge) => {
                          const badgeColor = badge.color || DEFAULT_BADGE_COLOR;
                          return (
                            <span
                              key={`${badge.name}-${badge.color || "default"}`}
                              className={badgeClass}
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
                        {awardBadges.length === 0 && !hasRecommendation && (
                          <span className="text-xs text-slate-400">无</span>
                        )}
                        {hasRecommendation && (
                          <span className="inline-flex items-center text-xs border rounded-full px-2 py-0.5 mr-1 mb-1 bg-blue-50 border-blue-200 text-blue-700">
                            推荐
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  {submission.reviewer_tags.length > 0 ? (
                    <button className="text-blue-600 text-xs" type="button" onClick={() => setDetailTarget(submission.reviewer_tags)}>
                      {submission.reviewer_tags.length} 条推荐
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">暂无</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isReviewer ? (
                    <button
                      className="px-3 py-1 border rounded text-xs"
                      type="button"
                      onClick={() => setRecommendationTarget(submission)}
                    >
                      {submission.my_recommendation ? "编辑推荐" : "推荐"}
                    </button>
                  ) : (
                    <button
                      className="px-3 py-1 border rounded text-xs"
                      type="button"
                      onClick={() => setAwardTarget(submission)}
                    >
                      评奖
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {submissions.length === 0 && !loading && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                  暂无数据
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                  加载中...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {recommendationTarget && token && (
        <RecommendationModal
          submission={recommendationTarget}
          token={token}
          onClose={() => setRecommendationTarget(null)}
          onSaved={handleRecommendationSaved}
        />
      )}
      {awardTarget && token && user?.role === "admin" && (
        <AwardModal
          submission={awardTarget}
          token={token}
          awards={awardDefs}
          onClose={() => setAwardTarget(null)}
          onSaved={handleAwardSaved}
        />
      )}
      {detailTarget && (
        <RecommendationDetailModal recommendations={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
};

const RecommendationModal = ({
  submission,
  token,
  onClose,
  onSaved,
}: {
  submission: AwardSubmission;
  token: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) => {
  const [reason, setReason] = useState(submission.my_recommendation?.reason || "");
  const [confidence, setConfidence] = useState(
    submission.my_recommendation?.confidence !== undefined && submission.my_recommendation?.confidence !== null
      ? String(submission.my_recommendation.confidence)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient(`/api/awards/submissions/${submission.id}/recommendation`, {
        method: "POST",
        token,
        body: JSON.stringify({
          reason,
          confidence: confidence ? Number(confidence) : null,
        }),
      });
      onSaved("推荐已保存");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!submission.my_recommendation) return;
    if (!window.confirm("确认删除这条推荐记录？")) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient(`/api/awards/submissions/${submission.id}/recommendation`, {
        method: "DELETE",
        token,
      });
      onSaved("推荐已删除");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form className="bg-white rounded shadow max-w-lg w-full p-5 space-y-4" onSubmit={submit}>
        <div>
          <h2 className="text-lg font-semibold mb-1">{submission.title}</h2>
          <p className="text-sm text-slate-500">填写推荐理由及信心度。</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium">推荐理由</label>
          <textarea
            className="mt-1 w-full border rounded px-3 py-2 h-32"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Confidence（0-100，可选）</label>
          <input
            type="number"
            className="mt-1 w-full border rounded px-3 py-2"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            placeholder="例如 95"
            min={0}
            max={100}
          />
        </div>
        <div className="flex justify-between">
          <button type="button" className="px-3 py-2 border rounded text-sm" onClick={onClose}>
            取消
          </button>
          <div className="space-x-2">
            {submission.my_recommendation && (
              <button type="button" className="px-3 py-2 border border-red-400 text-red-600 rounded text-sm" onClick={remove}>
                删除
              </button>
            )}
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm" disabled={saving}>
              {saving ? "保存中..." : "确认"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const AwardModal = ({
  submission,
  token,
  awards,
  onClose,
  onSaved,
}: {
  submission: AwardSubmission;
  token: string;
  awards: AwardDefinition[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) => {
  const [selected, setSelected] = useState<number[]>(
    submission.award_tags
      .map((tag) => awards.find((award) => award.name === tag)?.id)
      .filter((id): id is number => Boolean(id))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (awardId: number) => {
    setSelected((prev) => (prev.includes(awardId) ? prev.filter((id) => id !== awardId) : [...prev, awardId]));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient(`/api/awards/submissions/${submission.id}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ award_ids: selected }),
      });
      onSaved("奖项已更新");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form className="bg-white rounded shadow max-w-lg w-full p-5 space-y-4" onSubmit={submit}>
        <div>
          <h2 className="text-lg font-semibold">评奖：{submission.title}</h2>
          <p className="text-sm text-slate-500">可多选，更新后前台即展示。</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}
        <div className="max-h-60 overflow-auto border rounded p-3 space-y-2">
          {awards.length === 0 && <div className="text-sm text-slate-400">暂无配置的奖项，请先在后台添加。</div>}
          {awards.map((award) => (
            <label key={award.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(award.id)} onChange={() => toggle(award.id)} />
              <span>
                {award.name}
                {award.description && <span className="text-xs text-slate-400 ml-2">{award.description}</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-2 border rounded text-sm" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm" disabled={saving}>
            {saving ? "保存中..." : "确认"}
          </button>
        </div>
      </form>
    </div>
  );
};

const RecommendationDetailModal = ({ recommendations, onClose }: { recommendations: Recommendation[]; onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow max-w-lg w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">推荐记录</h3>
          <button className="text-sm text-slate-500" onClick={onClose}>
            关闭
          </button>
        </div>
        {recommendations.length === 0 ? (
          <div className="text-sm text-slate-500">暂无推荐记录</div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {recommendations.map((rec) => (
              <div key={`${rec.reviewer_id}-${rec.updated_at}`} className="border rounded p-3">
                <div className="text-sm font-semibold">
                  {rec.reviewer_name}
                  <span className="text-xs text-slate-400 ml-2">{new Date(rec.updated_at).toLocaleString()}</span>
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-line mt-1">{rec.reason}</div>
                {rec.confidence !== null && rec.confidence !== undefined && (
                  <div className="text-xs text-slate-500 mt-1">Confidence：{rec.confidence}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AwardsManagementPage;
