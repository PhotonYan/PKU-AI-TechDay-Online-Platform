import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

const AuthorRegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    school: "",
    college: "",
    grade: "",
    student_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await apiClient("/api/authors/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMessage("注册成功，请使用邮箱密码登录");
      setTimeout(() => navigate("/login", { replace: true }), 1000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">作者注册</h1>
        <p className="text-sm text-slate-500 mt-1">填写信息后即可提交作品，支持多次投稿。</p>
      </div>
      {message && <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}
      <form className="grid gap-4" onSubmit={handleSubmit}>
        {[
          { key: "name", label: "姓名" },
          { key: "email", label: "邮箱", type: "email" },
          { key: "password", label: "密码", type: "password" },
          { key: "school", label: "学校" },
          { key: "college", label: "学院" },
          { key: "grade", label: "界别" },
          { key: "student_id", label: "学号" },
        ].map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium">{field.label}</label>
            <input
              required
              type={field.type || "text"}
              className="mt-1 border rounded px-3 py-2 w-full"
              value={(form as any)[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
            />
          </div>
        ))}
        <button type="submit" className="bg-blue-600 text-white py-2 rounded disabled:opacity-60" disabled={submitting}>
          {submitting ? "提交中..." : "提交注册"}
        </button>
      </form>
      <div className="text-sm text-slate-600">
        想报名志愿服务？
        <Link to="/volunteer/register" className="text-blue-600 ml-1">
          前往志愿者入口
        </Link>
      </div>
    </div>
  );
};

export default AuthorRegisterPage;
