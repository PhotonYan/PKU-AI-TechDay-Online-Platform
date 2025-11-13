import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "../api/client";

interface PaperDetail {
  id: number;
  title: string;
  author: string;
  abstract: string;
  direction: string;
  contact: string;
  venue: string;
  showVotes: boolean;
  vote_innovation?: number;
  vote_impact?: number;
  vote_feasibility?: number;
}

const PaperDetailPage = () => {
  const { id } = useParams();
  const [paper, setPaper] = useState<PaperDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient(`/api/papers/${id}`).then(setPaper);
  }, [id]);

  if (!paper) return <div>加载中...</div>;

  return (
    <div className="bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-semibold mb-2">{paper.title}</h1>
      <div className="text-sm text-slate-600 mb-4">
        作者：{paper.author} · 方向：{paper.direction}
      </div>
      <div className="mb-4">
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
      </div>
      {paper.showVotes && (
        <div className="mt-4 text-sm">
          <div>投票数据：</div>
          <div>创新：{paper.vote_innovation}</div>
          <div>影响：{paper.vote_impact}</div>
          <div>可行：{paper.vote_feasibility}</div>
        </div>
      )}
    </div>
  );
};

export default PaperDetailPage;
