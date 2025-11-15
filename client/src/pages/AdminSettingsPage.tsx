import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Organization {
  id: number;
  name: string;
  responsibility: string;
}

interface RoleTemplate {
  id: number;
  name: string;
  can_edit_vote_data: boolean;
}

interface Direction {
  id: number;
  name: string;
  description?: string | null;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  organization_id?: number;
  organization?: string;
  role_template_id?: number | null;
  vote_counter_opt_in?: boolean;
  volunteer_tracks?: string[];
  assigned_tracks?: string[];
}

interface ReviewerInvite {
  id: number;
  code: string;
  preset_direction_id?: number | null;
  preset_direction_name?: string | null;
  reviewer_name?: string | null;
  reviewer_direction_name?: string | null;
  is_used: boolean;
  created_at: string;
}

interface AwardDefinition {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
}

const AdminSettingsPage = () => {
  const { token, user: authUser } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filters, setFilters] = useState({ role: "all", org: "all", template: "all" });
  const [settings, setSettings] = useState<{
    show_vote_data: boolean;
    vote_sort_enabled: boolean;
    vote_edit_role_template_id: number | null;
    visible_award_ids: number[];
  }>({ show_vote_data: false, vote_sort_enabled: false, vote_edit_role_template_id: null, visible_award_ids: [] });
  const [orgForm, setOrgForm] = useState({ name: "", responsibility: "" });
  const [editingOrgId, setEditingOrgId] = useState<number | null>(null);
  const [orgEditForm, setOrgEditForm] = useState({ name: "", responsibility: "" });
  const [roleForm, setRoleForm] = useState({ name: "", can_edit_vote_data: false });
  const [showOrgEditor, setShowOrgEditor] = useState(true);
  const [directionForm, setDirectionForm] = useState({ name: "", description: "" });
  const [editingDirectionId, setEditingDirectionId] = useState<number | null>(null);
  const [directionEditForm, setDirectionEditForm] = useState({ name: "", description: "" });
  const [reviewerInvites, setReviewerInvites] = useState<ReviewerInvite[]>([]);
  const [inviteForm, setInviteForm] = useState({ code: "", preset_direction_id: "" });
  const [awards, setAwards] = useState<AwardDefinition[]>([]);
  const [awardForm, setAwardForm] = useState({ name: "", description: "", color: "#F59E0B" });
  const [editingAwardId, setEditingAwardId] = useState<number | null>(null);
  const [awardEditForm, setAwardEditForm] = useState({ name: "", description: "", color: "#F59E0B" });
  const [showAwardSelector, setShowAwardSelector] = useState(false);

  const loadAll = () => {
    if (!token) return;
    apiClient("/api/admin/organizations", { token }).then(setOrgs);
    apiClient("/api/admin/roles", { token }).then(setRoles);
    apiClient("/api/admin/directions", { token }).then(setDirections);
    apiClient("/api/admin/users", { token }).then(setUsers);
    apiClient("/api/admin/reviewer-invites", { token }).then(setReviewerInvites);
    apiClient("/api/awards", { token }).then((data) => setAwards(data as AwardDefinition[]));
    apiClient("/api/admin/settings/votes", { token }).then((data) =>
      setSettings({
        show_vote_data: data.show_vote_data,
        vote_sort_enabled: data.vote_sort_enabled,
        vote_edit_role_template_id: data.vote_edit_role_template_id ?? null,
        visible_award_ids: (data.visible_award_ids as number[]) || [],
      })
    );
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const saveSettings = async () => {
    if (!token) return;
    await apiClient("/api/admin/settings/votes", {
      method: "PUT",
      token,
      body: JSON.stringify({
        show_vote_data: settings.show_vote_data,
        vote_sort_enabled: settings.vote_sort_enabled,
        vote_edit_role_template_id: settings.vote_edit_role_template_id,
        visible_award_ids: settings.visible_award_ids.length > 0 ? settings.visible_award_ids : null,
      }),
    });
    loadAll();
  };

  const submitOrg = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    await apiClient("/api/admin/organizations", { method: "POST", token, body: JSON.stringify(orgForm) });
    setOrgForm({ name: "", responsibility: "" });
    loadAll();
  };

  const startEditOrg = (org: Organization) => {
    setEditingOrgId(org.id);
    setOrgEditForm({ name: org.name, responsibility: org.responsibility });
  };

  const saveOrgEdit = async () => {
    if (!token || editingOrgId === null) return;
    await apiClient(`/api/admin/organizations/${editingOrgId}`, {
      method: "PUT",
      token,
      body: JSON.stringify(orgEditForm),
    });
    setEditingOrgId(null);
    loadAll();
  };

  const submitRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    await apiClient("/api/admin/roles", { method: "POST", token, body: JSON.stringify(roleForm) });
    setRoleForm({ name: "", can_edit_vote_data: false });
    loadAll();
  };

  const submitDirection = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    await apiClient("/api/admin/directions", { method: "POST", token, body: JSON.stringify(directionForm) });
    setDirectionForm({ name: "", description: "" });
    loadAll();
  };

  const startEditDirection = (direction: Direction) => {
    setEditingDirectionId(direction.id);
    setDirectionEditForm({ name: direction.name, description: direction.description || "" });
  };

  const saveDirectionEdit = async () => {
    if (!token || editingDirectionId === null) return;
    await apiClient(`/api/admin/directions/${editingDirectionId}`, {
      method: "PUT",
      token,
      body: JSON.stringify(directionEditForm),
    });
    setEditingDirectionId(null);
    loadAll();
  };

  const deleteDirection = async (directionId: number) => {
    if (!token) return;
    if (!window.confirm("确认删除该方向？")) return;
    try {
      await apiClient(`/api/admin/directions/${directionId}`, { method: "DELETE", token });
      loadAll();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const updateUser = async (userId: number, payload: Partial<UserRow>) => {
    if (!token) return;
    const bodyPayload: Record<string, unknown> = {};
    if (payload.organization_id !== undefined) {
      bodyPayload.organization_id = payload.organization_id || null;
    }
    if (payload.role_template_id !== undefined) {
      bodyPayload.role_template_id = payload.role_template_id || null;
    }
    if (payload.role) {
      bodyPayload.role = payload.role;
    }
    if (payload.vote_counter_opt_in !== undefined) {
      bodyPayload.vote_counter_opt_in = payload.vote_counter_opt_in;
    }
    if (payload.assigned_tracks !== undefined) {
      bodyPayload.assigned_tracks = payload.assigned_tracks;
    }
    await apiClient(`/api/admin/users/${userId}`, {
      method: "PUT",
      token,
      body: JSON.stringify(bodyPayload),
    });
    loadAll();
  };

  const deleteUser = async (userId: number) => {
    if (!token) return;
    await apiClient(`/api/admin/users/${userId}`, { method: "DELETE", token });
    loadAll();
  };

  const toggleUserOrg = (user: UserRow, orgName: string) => {
    if (authUser?.id === user.id) return;
    const current = user.assigned_tracks || [];
    const next = current.includes(orgName)
      ? current.filter((name: string) => name !== orgName)
      : [...current, orgName];
    updateUser(user.id, { assigned_tracks: next });
  };

  const getVoteButtonClass = (user: UserRow) => {
    const voteTemplateId = settings.vote_edit_role_template_id;
    const isSelected = Boolean(voteTemplateId && user.role_template_id === voteTemplateId);
    const volunteered = Boolean(user.vote_counter_opt_in);
    if (isSelected) return "bg-blue-600 text-white border-blue-600";
    if (volunteered) return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-white text-slate-700 border-slate-300";
  };

  const handleVoteButtonClick = (user: UserRow) => {
    if (authUser?.id === user.id || user.role === "author") return;
    const voteTemplateId = settings.vote_edit_role_template_id;
    const isSelected = Boolean(voteTemplateId && user.role_template_id === voteTemplateId);
    const volunteered = Boolean(user.vote_counter_opt_in);
    if (!volunteered) {
      updateUser(user.id, { vote_counter_opt_in: true });
      return;
    }
    if (!isSelected) {
      if (!voteTemplateId) {
        alert("请先在列表展示设置中指定可计票的角色模板");
        return;
      }
      updateUser(user.id, { role_template_id: voteTemplateId });
      return;
    }
    updateUser(user.id, { vote_counter_opt_in: false, role_template_id: null });
  };

  const submitInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    await apiClient("/api/admin/reviewer-invites", {
      method: "POST",
      token,
      body: JSON.stringify({
        code: inviteForm.code || undefined,
        preset_direction_id: inviteForm.preset_direction_id ? Number(inviteForm.preset_direction_id) : null,
      }),
    });
    setInviteForm({ code: "", preset_direction_id: "" });
    loadAll();
  };

  const deleteInvite = async (inviteId: number) => {
    if (!token) return;
    if (!window.confirm("确认删除该邀请码？")) return;
    await apiClient(`/api/admin/reviewer-invites/${inviteId}`, { method: "DELETE", token });
    loadAll();
  };

  const submitAward = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!awardForm.name.trim()) return;
    await apiClient("/api/awards", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: awardForm.name,
        description: awardForm.description || undefined,
        color: awardForm.color || undefined,
      }),
    });
    setAwardForm({ name: "", description: "", color: "#F59E0B" });
    loadAll();
  };

  const startEditAward = (award: AwardDefinition) => {
    setEditingAwardId(award.id);
    setAwardEditForm({ name: award.name, description: award.description || "", color: award.color || "#F59E0B" });
  };

  const saveAwardEdit = async () => {
    if (!token || editingAwardId === null) return;
    await apiClient(`/api/awards/${editingAwardId}`, {
      method: "PUT",
      token,
      body: JSON.stringify({
        name: awardEditForm.name,
        description: awardEditForm.description,
        color: awardEditForm.color,
      }),
    });
    setEditingAwardId(null);
    loadAll();
  };

  const deleteAward = async (awardId: number) => {
    if (!token) return;
    if (!window.confirm("确认删除该奖项？")) return;
    await apiClient(`/api/awards/${awardId}`, { method: "DELETE", token });
    loadAll();
  };

  const toggleVisibleAward = (awardId: number) => {
    setSettings((prev) => {
      const list = prev.visible_award_ids || [];
      const exists = list.includes(awardId);
      return {
        ...prev,
        visible_award_ids: exists ? list.filter((id) => id !== awardId) : [...list, awardId],
      };
    });
  };

  const visibleAwardNames =
    settings.visible_award_ids.length === 0
      ? "全部奖项"
      : awards
          .filter((award) => settings.visible_award_ids.includes(award.id))
          .map((award) => award.name)
          .join("、") || "全部奖项";


  const filteredUsers = users.filter((u) => {
    if (filters.role !== "all" && u.role !== filters.role) return false;
    if (filters.org !== "all" && !(u.assigned_tracks || []).includes(filters.org)) return false;
    if (filters.template === "none" && u.role_template_id) return false;
    if (filters.template !== "all" && filters.template !== "none" && u.role_template_id !== Number(filters.template))
      return false;
    return true;
  });

  const exportUsers = async () => {
    if (!token) return;
    const res = await fetch(`${apiClient.baseURL}/api/admin/users/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "users.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6">
      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">列表展示设置</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.show_vote_data}
              onChange={(e) => setSettings({ ...settings, show_vote_data: e.target.checked })}
            />
            列表展示投票数据
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.vote_sort_enabled}
              onChange={(e) => setSettings({ ...settings, vote_sort_enabled: e.target.checked })}
            />
            允许按投票排序
          </label>
          <div className="text-sm">
            <button
              type="button"
              className="px-3 py-1 border rounded text-xs"
              onClick={() => setShowAwardSelector((prev) => !prev)}
            >
              {showAwardSelector ? "完成选择" : "选择展示奖项"}
            </button>
            <span className="ml-3 text-slate-500">当前：{visibleAwardNames}</span>
          </div>
          {showAwardSelector && (
            <div className="border rounded p-3 space-y-2 text-sm bg-slate-50">
              {awards.length === 0 && <div className="text-xs text-slate-500">暂无可选奖项</div>}
              {awards.map((award) => (
                <label key={award.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.visible_award_ids.includes(award.id)}
                    onChange={() => toggleVisibleAward(award.id)}
                  />
                  {award.name}
                </label>
              ))}
              {awards.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-blue-600"
                  onClick={() => setSettings((prev) => ({ ...prev, visible_award_ids: [] }))}
                >
                  清空并展示全部奖项
                </button>
              )}
            </div>
          )}
          
          
          <div className="flex justify-end">
            <button
              className="bg-red-500 text-white px-3 py-3 rounded text-xs"
              onClick={() => {
                if (confirm("确认更新列表展示设置？")) {
                  saveSettings();
                }
              }}
            >
              保存
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">组织管理</h2>
        <form className="grid gap-3 md:grid-cols-[0.7fr,2fr,1fr]" onSubmit={submitOrg}>
          <input
            className="border rounded px-3 py-2"
            placeholder="组织名称"
            value={orgForm.name}
            onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="职责"
            value={orgForm.responsibility}
            onChange={(e) => setOrgForm({ ...orgForm, responsibility: e.target.value })}
          />
          <button className="bg-emerald-600 text-white px-4 py-2 rounded" type="submit">
            新增
          </button>
        </form>
        <ul className="mt-3 text-sm space-y-1">
          {orgs.map((org) => (
            <li key={org.id} className="flex items-center justify-between">
              <span>
                {org.name} — {org.responsibility}
              </span>
              <button className="text-blue-600 text-xs" type="button" onClick={() => startEditOrg(org)}>
                编辑
              </button>
            </li>
          ))}
        </ul>
        {editingOrgId !== null && (
          <div className="mt-4 border rounded p-3 space-y-2 bg-slate-50">
            <div className="text-sm font-medium">编辑工作组</div>
            <input
              className="border rounded px-3 py-2 w-full"
              value={orgEditForm.name}
              onChange={(e) => setOrgEditForm({ ...orgEditForm, name: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2 w-full"
              value={orgEditForm.responsibility}
              onChange={(e) => setOrgEditForm({ ...orgEditForm, responsibility: e.target.value })}
            />
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-blue-600 text-white rounded" type="button" onClick={saveOrgEdit}>
                保存
              </button>
              <button className="px-3 py-1 border rounded" type="button" onClick={() => setEditingOrgId(null)}>
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">方向管理</h2>
        <form className="grid gap-3 md:grid-cols-[0.7fr,2fr,1fr]" onSubmit={submitDirection}>
          <input
            className="border rounded px-3 py-2"
            placeholder="方向名称"
            value={directionForm.name}
            onChange={(e) => setDirectionForm({ ...directionForm, name: e.target.value })}
            required
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="描述"
            value={directionForm.description}
            onChange={(e) => setDirectionForm({ ...directionForm, description: e.target.value })}
          />
          <button className="bg-emerald-600 text-white px-4 py-2 rounded" type="submit">
            新增
          </button>
        </form>
        <ul className="mt-3 text-sm space-y-1">
          {directions.map((direction) => (
            <li key={direction.id} className="flex items-center justify-between">
              <span>
                {direction.name} — {direction.description || "未填写"}
              </span>
              <div className="space-x-3 text-xs">
                <button className="text-blue-600" type="button" onClick={() => startEditDirection(direction)}>
                  编辑
                </button>
                <button className="text-red-600" type="button" onClick={() => deleteDirection(direction.id)}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
        {editingDirectionId !== null && (
          <div className="mt-4 border rounded p-3 space-y-2 bg-slate-50">
            <div className="text-sm font-medium">编辑方向</div>
            <input
              className="border rounded px-3 py-2 w-full"
              value={directionEditForm.name}
              onChange={(e) => setDirectionEditForm({ ...directionEditForm, name: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2 w-full"
              value={directionEditForm.description}
              onChange={(e) => setDirectionEditForm({ ...directionEditForm, description: e.target.value })}
            />
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-blue-600 text-white rounded" type="button" onClick={saveDirectionEdit}>
                保存
              </button>
              <button className="px-3 py-1 border rounded" type="button" onClick={() => setEditingDirectionId(null)}>
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">审阅者邀请码管理</h2>
        <p className="text-sm text-slate-500 mb-4">邀请码创建后发给老师，注册成功后列表会显示其姓名与方向。</p>
        <form className="grid gap-3 md:grid-cols-[1fr,1fr,120px]" onSubmit={submitInvite}>
          <input
            className="border rounded px-3 py-2"
            placeholder="自定义邀请码（留空自动生成）"
            value={inviteForm.code}
            onChange={(e) => setInviteForm({ ...inviteForm, code: e.target.value })}
          />
          <select
            className="border rounded px-3 py-2"
            value={inviteForm.preset_direction_id}
            onChange={(e) => setInviteForm({ ...inviteForm, preset_direction_id: e.target.value })}
          >
            <option value="">不预设方向</option>
            {directions.map((direction) => (
              <option key={direction.id} value={direction.id}>
                {direction.name}
              </option>
            ))}
          </select>
          <button className="bg-emerald-600 text-white px-4 py-2 rounded" type="submit">
            新建邀请码
          </button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-2 py-2">邀请码</th>
                <th className="px-2 py-2">状态</th>
                <th className="px-2 py-2">审阅方向</th>
                <th className="px-2 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {reviewerInvites.map((invite) => (
                <tr key={invite.id} className="border-t">
                  <td className="px-2 py-2 font-mono">{invite.code}</td>
                  <td className="px-2 py-2">
                    {invite.is_used ? (
                      <div>
                        <div className="text-slate-700 font-medium">{invite.reviewer_name || "-"}</div>
                        <div className="text-xs text-slate-400">已注册</div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">未使用</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {invite.reviewer_direction_name ||
                      invite.preset_direction_name ||
                      (invite.preset_direction_id ? invite.preset_direction_id : "未指定")}
                  </td>
                  <td className="px-2 py-2">
                    {!invite.is_used && (
                      <button className="text-red-600 text-xs" type="button" onClick={() => deleteInvite(invite.id)}>
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {reviewerInvites.length === 0 && (
                <tr>
                  <td className="px-2 py-4 text-center text-slate-400" colSpan={4}>
                    暂无邀请码
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">奖项配置</h2>
        <form className="grid gap-3 md:grid-cols-[1fr,2fr,0.6fr,120px]" onSubmit={submitAward}>
          <input
            className="border rounded px-3 py-2"
            placeholder="奖项名称"
            value={awardForm.name}
            onChange={(e) => setAwardForm({ ...awardForm, name: e.target.value })}
            required
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="描述（可选）"
            value={awardForm.description}
            onChange={(e) => setAwardForm({ ...awardForm, description: e.target.value })}
          />
          <label className="flex items-center gap-2 border rounded px-3 py-2 text-sm">
            <span>颜色</span>
            <input
              className="flex-1 h-8 cursor-pointer"
              type="color"
              value={awardForm.color}
              onChange={(e) => setAwardForm({ ...awardForm, color: e.target.value })}
              title="标签颜色"
            />
          </label>
          <button className="bg-emerald-600 text-white px-4 py-2 rounded" type="submit">
            新建奖项
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {awards.map((award) => (
            <li key={award.id} className="flex items-center justify-between border-b pb-2 gap-3">
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full border"
                    style={{ backgroundColor: award.color || "#FBBF24", borderColor: award.color || "#EAB308" }}
                  />
                  {award.name}
                </div>
                <div className="text-xs text-slate-500">{award.description || "无描述"}</div>
              </div>
              <div className="space-x-2 text-xs">
                <button className="text-blue-600" type="button" onClick={() => startEditAward(award)}>
                  编辑
                </button>
                <button className="text-red-600" type="button" onClick={() => deleteAward(award.id)}>
                  删除
                </button>
              </div>
            </li>
          ))}
          {awards.length === 0 && <li className="text-slate-400 text-sm">尚未配置奖项</li>}
        </ul>
        {editingAwardId !== null && (
          <div className="mt-4 border rounded p-3 space-y-2 bg-slate-50">
          <div className="text-sm font-medium">编辑奖项</div>
        
          {/* 三个框放在一行 */}
          <div className="flex items-center gap-4">
            <input
              className="border rounded px-4 py-2 w-1/3"
              value={awardEditForm.name}
              placeholder="奖项名称"
              onChange={(e) => setAwardEditForm({ ...awardEditForm, name: e.target.value })}
            />
        
            <input
              className="border rounded px-4 py-2 w-1/2"
              value={awardEditForm.description}
              placeholder="奖项描述"
              onChange={(e) =>
                setAwardEditForm({ ...awardEditForm, description: e.target.value })
              }
            />
        
            <label className="flex items-center gap-2 border rounded px-3 py-2 w-40">
              <span className="text-sm whitespace-nowrap">颜色</span>
              <input
                className="flex-1 h-8 cursor-pointer"
                type="color"
                value={awardEditForm.color}
                onChange={(e) =>
                  setAwardEditForm({ ...awardEditForm, color: e.target.value })
                }
              />
            </label>
          </div>
        
          <div className="flex gap-2">
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded"
              type="button"
              onClick={saveAwardEdit}
            >
              保存
            </button>
            <button
              className="px-3 py-1 border rounded"
              type="button"
              onClick={() => setEditingAwardId(null)}
            >
              取消
            </button>
          </div>
        </div>
        )}
      </section>

      <section className="bg-white p-6 rounded shadow overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3">用户角色与组织</h2>
        <div className="flex items-center gap-3 mb-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showOrgEditor} onChange={(e) => setShowOrgEditor(e.target.checked)} />
            显示工作组多选按钮
          </label>
          <button className="px-3 py-1 border rounded text-xs" type="button" onClick={exportUsers}>
            导出当前人员
          </button>
        </div>
        <table className="min-w-full text-sm table-fixed">
          <thead>
            <tr>
              {["姓名", "邮箱", "角色", "组织", "计票志愿者", "操作"].map((label) => (
                <th key={label} className="text-left px-2 py-2">
                  {label}
                </th>
              ))}
            </tr>
            {/* <tr className="text-xs text-slate-500">
              <th className="px-2" />
              <th className="px-2" />
              <th className="px-2">
                <select
                  className="border rounded px-2 py-1"
                  value={filters.role}
                  onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="all">全部角色</option>
                  <option value="admin">管理员</option>
                  <option value="volunteer">志愿者</option>
                </select>
              </th>
              <th className="px-2">
                <select
                  className="border rounded px-2 py-1"
                  value={filters.org}
                  onChange={(e) => setFilters((prev) => ({ ...prev, org: e.target.value }))}
                >
                  <option value="all">全部工作组</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.name}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-2">
                <select
                  className="border rounded px-2 py-1"
                  value={filters.template}
                  onChange={(e) => setFilters((prev) => ({ ...prev, template: e.target.value }))}
                >
                  <option value="all">全部模板</option>
                  <option value="none">无</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-2" />
              <th className="px-2" />
            </tr> */}
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-2 py-2">{u.name}</td>
                <td className="px-2 py-2 break-all">{u.email}</td>
                <td className="px-2 py-2">
                  <select
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    className="border rounded px-2"
                    disabled={authUser?.id === u.id}
                  >
                    <option value="volunteer">志愿者</option>
                    <option value="admin">管理员</option>
                    <option value="author">作者</option>
                  </select>
                </td>
                <td className="px-2 py-2 max-w-xs">
                  {u.role === "author" ? (
                    <div className="text-xs text-slate-400">作者无需分组</div>
                  ) : (
                    <>
                      <div className="text-xs text-slate-600 whitespace-pre-wrap break-words">
                        当前：{(u.assigned_tracks || []).join("、") || "未分配"}
                      </div>
                      {(u.volunteer_tracks || []).length > 0 && (
                        <div className="text-xs text-slate-400 mt-1">志愿：{(u.volunteer_tracks || []).join("、")}</div>
                      )}
                      {showOrgEditor && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {orgs.map((org) => {
                            const assigned = (u.assigned_tracks || []).includes(org.name);
                            const preferred = (u.volunteer_tracks || []).includes(org.name);
                            let colorClass = "bg-white text-slate-700";
                            if (assigned) {
                              colorClass = "bg-blue-600 text-white";
                            } else if (preferred) {
                              colorClass = "bg-blue-100 text-blue-700";
                            }
                            return (
                              <button
                                key={org.id}
                                type="button"
                                disabled={authUser?.id === u.id}
                                className={`border rounded px-2 py-0.5 text-xs whitespace-normal break-words ${colorClass}`}
                                onClick={() => toggleUserOrg(u, org.name)}
                              >
                                {org.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td className="px-2 py-2">
                  {u.role === "author" ? (
                    <span className="text-xs text-slate-400">作者无需计票</span>
                  ) : (
                    <button
                      className={`px-3 py-1 border rounded text-xs ${getVoteButtonClass(u)}`}
                      type="button"
                      disabled={authUser?.id === u.id}
                      onClick={() => handleVoteButtonClick(u)}
                    >
                      计票
                    </button>
                  )}
                </td>
                <td className="px-2 py-2">
                  <button
                    className="text-red-600 text-xs disabled:opacity-50"
                    type="button"
                    onClick={() => {
                      if (window.confirm("确认删除该用户？")) deleteUser(u.id);
                    }}
                    disabled={authUser?.id === u.id}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default AdminSettingsPage;
