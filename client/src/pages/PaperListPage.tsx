import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";

interface PaperListItem {
  id: number;
  title: string;
  author: string;
  direction: string;
  vote_innovation?: number;
  vote_impact?: number;
  vote_feasibility?: number;
}

const voteFields = [
  { key: "vote_innovation", label: "创新" },
  { key: "vote_impact", label: "影响" },
  { key: "vote_feasibility", label: "可行" },
] as const;

const PaperListPage = () => {
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [showVotes, setShowVotes] = useState(false);
  const [canSort, setCanSort] = useState(false);
  const [sort, setSort] = useState<string>("");

  useEffect(() => {
    const query = sort ? `?sort=${sort}` : "";
    apiClient(`/api/papers${query}`)
      .then((data) => {
        setPapers(data.papers);
        setShowVotes(data.showVotes);
        setCanSort(data.canSort);
      })
      .catch((err) => console.error(err));
  }, [sort]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">成果展示</h1>
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
      </div>
      <div className="bg-white shadow rounded divide-y">
        {papers.map((paper) => (
          <Link key={paper.id} to={`/papers/${paper.id}`} className="block px-4 py-3 hover:bg-slate-50">
            <div className="font-semibold">{paper.title}</div>
            <div className="text-sm text-slate-600">{paper.author}</div>
            <div className="text-sm text-slate-500">方向：{paper.direction}</div>
            {showVotes && (
              <div className="text-xs text-slate-500 mt-1">
                {voteFields.map((field) => (
                  <span key={field.key} className="mr-4">
                    {field.label}:{" "}
                    {(paper as any)[field.key] ?? "-"}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
        {papers.length === 0 && <div className="p-4 text-center text-slate-500">暂无数据</div>}
      </div>
    </div>
  );
};

export default PaperListPage;
