import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

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
  { key: "vote_innovation", label: "最佳创意" },
  { key: "vote_impact", label: "最受欢迎" },
  { key: "vote_feasibility", label: "不明觉厉" },
] as const;

const PaperListPage = () => {
  const { token, user } = useAuth();
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [showVotes, setShowVotes] = useState(false);
  const [canSort, setCanSort] = useState(false);
  const [sort, setSort] = useState<string>("");
  const [voteInputs, setVoteInputs] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canEditVotes = Boolean(user && (user.role === "admin" || user.role_template_can_edit_vote));

  const loadPapers = () => {
    const query = sort ? `?sort=${sort}` : "";
    apiClient(`/api/papers${query}`)
      .then((data) => {
        setPapers(data.papers);
        setShowVotes(data.showVotes);
        setCanSort(data.canSort);
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadPapers();
  }, [sort]);

  const handleVoteInputChange = (paperId: number, value: string) => {
    setVoteInputs((prev) => ({ ...prev, [paperId]: value }));
  };

  const submitVotes = async (paper: PaperListItem, e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage("请先登录");
      return;
    }
    const raw = voteInputs[paper.id] || "";
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
    setSavingId(paper.id);
    setMessage(null);
    try {
      await apiClient(`/api/papers/${paper.id}/votes`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          vote_innovation: innovation,
          vote_impact: impact,
          vote_feasibility: feasibility,
        }),
      });
      setMessage("投票数据已更新");
      setVoteInputs((prev) => ({ ...prev, [paper.id]: "" }));
      loadPapers();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

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
      {message && <div className="mb-3 text-sm text-blue-600">{message}</div>}
      <div className="bg-white shadow rounded divide-y">
        {papers.map((paper) => (
          <div key={paper.id} className="px-4 py-3 hover:bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Link to={`/papers/${paper.id}`} className="font-semibold text-blue-700 hover:underline">
                  {paper.title}
                </Link>
                <div className="text-sm text-slate-600">{paper.author}</div>
                <div className="text-sm text-slate-500">方向：{paper.direction}</div>
              </div>
            </div>
            {showVotes && (
              <>
                <div className="text-xs text-slate-500">
                  {voteFields.map((field) => (
                    <span key={field.key} className="mr-4">
                      {field.label}: {(paper as any)[field.key] ?? "-"}
                    </span>
                  ))}
                </div>
                {canEditVotes && (
                <form className="flex items-center gap-2 text-xs" onSubmit={(e) => submitVotes(paper, e)}>
                  <input
                    className="border rounded px-2 py-1 text-sm w-40"
                    placeholder="创/欢/不"
                    value={voteInputs[paper.id] ?? ""}
                    onChange={(e) => handleVoteInputChange(paper.id, e.target.value)}
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 border rounded text-sm"
                    disabled={savingId === paper.id}
                  >
                    {savingId === paper.id ? "保存中..." : "保存"}
                  </button>
                </form>
                )}
              </>
            )}
          </div>
        ))}
        {papers.length === 0 && <div className="p-4 text-center text-slate-500">暂无数据</div>}
      </div>
    </div>
  );
};

export default PaperListPage;
