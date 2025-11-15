import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface Direction {
  id: number;
  name: string;
}

interface InviteInfo {
  code: string;
  preset_direction_id?: number | null;
  preset_direction_name?: string | null;
  is_used: boolean;
}

const ReviewerRegisterPage = () => {
  const navigate = useNavigate();
  const [directions, setDirections] = useState<Direction[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    invite_code: "",
    direction_id: "",
  });
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    apiClient("/api/directions")
      .then((data) => setDirections(data as Direction[]))
      .catch(() => setDirections([]));
  }, []);

  const checkInvite = async () => {
    if (!form.invite_code) return;
    setChecking(true);
    setError(null);
    try {
      const data = (await apiClient(`/api/reviewers/invites/${form.invite_code.trim()}`)) as InviteInfo;
      if (data.is_used) {
        setError("该邀请码已被使用");
        setInviteInfo(null);
      } else {
        setInviteInfo(data);
        if (data.preset_direction_id) {
          setForm((prev) => ({ ...prev, direction_id: String(data.preset_direction_id) }));
        }
      }
    } catch (err) {
      setInviteInfo(null);
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient("/api/reviewers/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          invite_code: form.invite_code.trim(),
          direction_id: inviteInfo?.preset_direction_id
            ? inviteInfo?.preset_direction_id
            : form.direction_id
            ? Number(form.direction_id)
            : null,
        }),
      });
      setMessage("注册成功，即将跳转至登录页...");
      setTimeout(() => navigate("/login?registered=1", { replace: true }), 1000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const directionLocked = Boolean(inviteInfo?.preset_direction_id);
  const availableDirections = directionLocked
    ? directions.filter((d) => d.id === inviteInfo?.preset_direction_id)
    : directions;

  return (
    <div className="max-w-xl mx-auto bg-white rounded shadow p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">审阅者注册</h1>
        <p className="text-sm text-slate-500 mt-1">请使用管理员提供的邀请码完成注册。</p>
      </div>
      {message && <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium">姓名</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">邮箱</label>
          <input
            type="email"
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="name@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">邀请码</label>
          <div className="flex gap-2">
            <input
              className="mt-1 flex-1 border rounded px-3 py-2"
              value={form.invite_code}
              onChange={(e) => setForm({ ...form, invite_code: e.target.value })}
              onBlur={checkInvite}
              required
            />
            <button
              type="button"
              className="mt-1 px-3 py-2 border rounded text-sm"
              onClick={checkInvite}
              disabled={checking}
            >
              {checking ? "验证中..." : "验证"}
            </button>
          </div>
          {inviteInfo?.preset_direction_name && (
            <p className="text-xs text-slate-500 mt-1">
              该邀请码预设方向：{inviteInfo.preset_direction_name}（注册后不可更改）
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium">审阅方向</label>
          {availableDirections.length > 0 ? (
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={form.direction_id}
              onChange={(e) => setForm({ ...form, direction_id: e.target.value })}
              disabled={directionLocked}
              required={!directionLocked}
            >
              {!directionLocked && <option value="">请选择方向</option>}
              {availableDirections.map((direction) => (
                <option key={direction.id} value={direction.id}>
                  {direction.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-red-500">管理员尚未配置方向，请稍后再试。</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium">设置密码</label>
          <input
            type="password"
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "提交中..." : "完成注册"}
        </button>
      </form>
      <div className="text-sm text-slate-600">
        已有账号？ <Link className="text-blue-600" to="/login">前往登录</Link>
      </div>
    </div>
  );
};

export default ReviewerRegisterPage;
