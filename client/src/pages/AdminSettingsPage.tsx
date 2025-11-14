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

const AdminSettingsPage = () => {
  const { token, user: authUser } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filters, setFilters] = useState({ role: "all", org: "all", template: "all" });
  const [settings, setSettings] = useState<{
    show_vote_data: boolean;
    vote_sort_enabled: boolean;
    vote_edit_role_template_id: number | null;
  }>({ show_vote_data: false, vote_sort_enabled: false, vote_edit_role_template_id: null });
  const [orgForm, setOrgForm] = useState({ name: "", responsibility: "" });
  const [editingOrgId, setEditingOrgId] = useState<number | null>(null);
  const [orgEditForm, setOrgEditForm] = useState({ name: "", responsibility: "" });
  const [roleForm, setRoleForm] = useState({ name: "", can_edit_vote_data: false });
  const [showOrgEditor, setShowOrgEditor] = useState(true);

  const loadAll = () => {
    if (!token) return;
    apiClient("/api/admin/organizations", { token }).then(setOrgs);
    apiClient("/api/admin/roles", { token }).then(setRoles);
    apiClient("/api/admin/users", { token }).then(setUsers);
    apiClient("/api/admin/settings/votes", { token }).then((data) =>
      setSettings({
        show_vote_data: data.show_vote_data,
        vote_sort_enabled: data.vote_sort_enabled,
        vote_edit_role_template_id: data.vote_edit_role_template_id ?? null,
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
      body: JSON.stringify(settings),
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

  const handleTemplateChange = (userId: number, value: string) => {
    if (value === "0") {
      updateUser(userId, { role_template_id: null });
    } else {
      updateUser(userId, { role_template_id: Number(value) });
    }
  };

  const filteredUsers = users.filter((u) => {
    if (filters.role !== "all" && u.role !== filters.role) return false;
    if (filters.org !== "all" && !(u.assigned_tracks || []).includes(filters.org)) return false;
    if (filters.template === "none" && u.role_template_id) return false;
    if (filters.template !== "all" && filters.template !== "none" && u.role_template_id !== Number(filters.template))
      return false;
    return true;
  });

  const uploadPaperCsv = async (file: File) => {
    if (!token) return;
    const form = new FormData();
    form.append("file", file);
    await apiClient("/api/papers/import", { method: "POST", body: form, token });
    alert("上传成功，成果展示已刷新");
  };

  const clearPapers = async () => {
    if (!token) return;
    if (!window.confirm("确定清空全部成果展示数据？")) return;
    await apiClient("/api/admin/papers/clear", { method: "POST", token });
    alert("成果展示数据已清空");
  };

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
          <label className="block text-sm">
            可编辑投票数据的角色模板
            <select
              className="mt-1 border rounded px-3 py-2"
              value={settings.vote_edit_role_template_id || 0}
              onChange={(e) =>
                setSettings({ ...settings, vote_edit_role_template_id: Number(e.target.value) || null })
              }
            >
              <option value={0}>仅管理员</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
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

      <section className="bg-white p-6 rounded shadow space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">成果展示数据管理</h2>
          <button className="px-3 py-2 border rounded text-xs text-red-600" type="button" onClick={clearPapers}>
            清空当前数据
          </button>
        </div>
        <label className="text-sm text-slate-600">上传 CSV（首列为“序号”）</label>
        <input type="file" accept=".csv" onChange={(e) => e.target.files && uploadPaperCsv(e.target.files[0])} />
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
              {["姓名", "邮箱", "角色", "组织", "角色模板", "计票志愿者", "操作"].map((label) => (
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
                  </select>
                </td>
                <td className="px-2 py-2 max-w-xs">
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
                </td>
                <td className="px-2 py-2">
                  <select
                    value={u.role_template_id || 0}
                    onChange={(e) => handleTemplateChange(u.id, e.target.value)}
                    className="border rounded px-2"
                    disabled={authUser?.id === u.id}
                  >
                    <option value={0}>无</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(u.vote_counter_opt_in)}
                      onChange={(e) => updateUser(u.id, { vote_counter_opt_in: e.target.checked })}
                      disabled={authUser?.id === u.id}
                    />
                    自愿
                  </label>
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
