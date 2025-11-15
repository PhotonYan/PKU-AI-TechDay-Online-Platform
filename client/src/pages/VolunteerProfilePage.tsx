import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

const VolunteerProfilePage = () => {
  const { token } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiClient("/api/volunteers/me", { token }).then(setProfile);
  }, [token]);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordStatus({ type: "error", message: "请输入完整的旧密码和新密码" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ type: "error", message: "两次输入的新密码不一致" });
      return;
    }
    try {
      setSubmitting(true);
      setPasswordStatus(null);
      await apiClient("/api/volunteers/me/password", {
        method: "POST",
        token,
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword,
        }),
      });
      setPasswordStatus({ type: "success", message: "密码修改成功" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      setPasswordStatus({ type: "error", message: error?.message || "修改失败，请稍后重试" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile) return <div>加载中...</div>;

  const responsibilities =
    profile.organizations_detail && profile.organizations_detail.length > 0
      ? profile.organizations_detail.map((org: any) => `${org.name}: ${org.responsibility}`).join(" ")
      : profile.responsibility || "由管理员分配";

  const voteCounterStatus = profile.role_template_can_edit_vote
    ? "是"
    : profile.vote_counter_opt_in
    ? "已申请"
    : "未报名";

  return (
    <div className="bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">个人信息</h1>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {(
          [
            ["姓名", profile.name],
            ["邮箱", profile.email],
            ["学校", profile.school],
            ["学院", profile.college],
            ["界别", profile.grade],
            ["学号", profile.student_id],
            ["志愿方向", (profile.volunteer_tracks || []).join("、")],
            ["可服务时段", (profile.availability_slots || []).join("、")],
            ["组织", (profile.assigned_tracks || []).join("、") || "待分配"],
            ["职责", responsibilities],
            ["计票志愿者", voteCounterStatus],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-slate-50 p-3 rounded">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-800">
              {label === "职责" && profile.organizations_detail && profile.organizations_detail.length > 0 ? (
                <div className="space-y-1">
                  {profile.organizations_detail.map((org: any) => (
                    <div key={org.id}>
                      <span className="font-semibold">{org.name}：</span>
                      {org.responsibility}
                    </div>
                  ))}
                </div>
              ) : (
                value || "-"
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">修改密码</h2>
        <form className="space-y-4 max-w-md" onSubmit={handlePasswordSubmit}>
          <div>
            <label className="block text-sm text-slate-600 mb-1" htmlFor="currentPassword">
              当前密码
            </label>
            <input
              id="currentPassword"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1" htmlFor="newPassword">
              新密码
            </label>
            <input
              id="newPassword"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1" htmlFor="confirmPassword">
              确认新密码
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete="new-password"
              required
            />
          </div>
          {passwordStatus && (
            <p
              className={`text-sm ${
                passwordStatus.type === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {passwordStatus.message}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "提交中..." : "保存修改"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VolunteerProfilePage;
