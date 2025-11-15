import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface AuthorSubmissionRow {
  id: number;
  title: string;
  track: string;
  direction?: string | null;
  direction_id?: number | null;
  status: string;
  publication_status: string;
}

const statusLabels: Record<string, string> = {
  pending: "待审核",
  approved: "通过",
  rejected: "未通过",
};

const trackLabels: Record<string, string> = {
  poster: "Poster Track",
  demo: "Demo Track",
};

const AuthorProfilePage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [submissions, setSubmissions] = useState<AuthorSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubmissions = () => {
    if (!token) return;
    apiClient("/api/authors/submissions", { token })
      .then((rows) => setSubmissions(rows as AuthorSubmissionRow[]))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiClient("/api/authors/me", { token }),
      apiClient("/api/authors/submissions", { token }),
    ])
      .then(([profileData, submissionData]) => {
        setProfile(profileData);
        setSubmissions(submissionData as AuthorSubmissionRow[]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const withdrawSubmission = async (id: number) => {
    if (!token) return;
    if (!window.confirm("确认撤稿并删除该投稿？")) return;
    try {
      await apiClient(`/api/authors/submissions/${id}`, { method: "DELETE", token });
      loadSubmissions();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!profile) {
    return <div className="text-red-600">{error || "无法加载作者信息"}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">作者信息</h1>
          <button className="text-sm text-blue-600" onClick={() => navigate("/author/submissions/new")}>上传新投稿</button>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {[
            ["姓名", profile.name],
            ["邮箱", profile.email],
            ["学校", profile.school],
            ["学院", profile.college],
            ["界别", profile.grade],
            ["学号", profile.student_id],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-slate-50 p-3 rounded">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-800">{value || "-"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-white rounded shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">我的投稿</h2>
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm" onClick={() => navigate("/author/submissions/new")}>上传作品</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-2 text-slate-500 font-medium">标题</th>
                <th className="px-3 py-2 text-slate-500 font-medium min-w-[200px]">方向</th>
                <th className="px-3 py-2 text-slate-500 font-medium min-w-[140px]">Track</th>
                <th className="px-3 py-2 text-slate-500 font-medium min-w-[80px]">状态</th>
                <th className="px-3 py-2 text-slate-500 font-medium min-w-[80px]">投稿状态</th>
                <th className="px-3 py-2 text-slate-500 font-medium min-w-[100px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{submission.title}</div>
                    <Link className="text-xs text-blue-600" to={`/papers/${submission.id}`}>
                      查看详情
                    </Link>
                  </td>
                  <td className="px-3 py-2">{submission.direction || "未分类"}</td>
                  <td className="px-3 py-2">{trackLabels[submission.track] || submission.track}</td>
                  <td className="px-3 py-2">{statusLabels[submission.status] || submission.status}</td>
                  <td className="px-3 py-2">{submission.publication_status === "published" ? "已发表" : "中稿"}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      className="text-blue-600 text-xs"
                      onClick={() => navigate(`/author/submissions/${submission.id}/edit`)}
                    >
                      编辑
                    </button>
                    <button className="text-red-600 text-xs" onClick={() => withdrawSubmission(submission.id)}>
                      撤稿
                    </button>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                    暂无投稿，点击右上角上传作品。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuthorProfilePage;
