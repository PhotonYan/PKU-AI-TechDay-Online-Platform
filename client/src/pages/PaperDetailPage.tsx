import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "../api/client";

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
  title: string;
  author?: string | null;
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

const PaperDetailPage = () => {
  const { id } = useParams();
  const [paper, setPaper] = useState<PaperDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient(`/api/submissions/${id}`).then(setPaper);
  }, [id]);

  if (!paper) return <div>加载中...</div>;

  return (
    <div className="bg-white p-6 rounded shadow space-y-4">
      <div>
        <h1 className="text-2xl font-semibold mb-2">{paper.title}</h1>
        <div className="text-sm text-slate-600 flex flex-wrap gap-3">
          <span>作者：{paper.author || "-"}</span>
          <span>方向：{paper.direction || "未分类"}</span>
          <span>Track：{paper.track === "poster" ? "Poster" : "Demo"}</span>
          {paper.award && <span className="text-amber-600">获奖：{paper.award}</span>}
        </div>
        <div className="text-xs text-slate-500 mt-1 flex gap-3">
          <span>审核状态：{paper.status === "approved" ? "通过" : paper.status === "pending" ? "待审核" : "未通过"}</span>
          <span>投稿状态：{paper.publication_status === "published" ? "已发表" : "中稿"}</span>
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
        <div className="bg-slate-50 p-3 rounded">
          <div className="font-medium">Poster PDF</div>
          {paper.poster_path ? (
            <a className="text-blue-600" href={`/${paper.poster_path}`} target="_blank" rel="noreferrer">
              点击查看
            </a>
          ) : (
            <div>未上传</div>
          )}
        </div>
        <div className="bg-slate-50 p-3 rounded">
          <div className="font-medium">Archive 授权</div>
          <div>{paper.archive_consent ? "已授权" : "未授权"}</div>
        </div>
      </div>
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
