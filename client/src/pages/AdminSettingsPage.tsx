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
  role_template_id?: number;
}

const AdminSettingsPage = () => {
  const { token } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [settings, setSettings] = useState<{
    show_vote_data: boolean;
    vote_sort_enabled: boolean;
    vote_edit_role_template_id: number | null;
  }>({ show_vote_data: false, vote_sort_enabled: false, vote_edit_role_template_id: null });
  const [orgForm, setOrgForm] = useState({ name: "", responsibility: "" });
  const [roleForm, setRoleForm] = useState({ name: "", can_edit_vote_data: false });

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
    await apiClient(`/api/admin/users/${userId}`, {
      method: "PUT",
      token,
      body: JSON.stringify(bodyPayload),
    });
    loadAll();
  };

  const uploadCsv = async (file: File) => {
    if (!token) return;
    const form = new FormData();
    form.append("file", file);
    await apiClient("/api/papers/import", { method: "POST", body: form, token });
    alert("CSV 导入成功");
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
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={saveSettings}>
            保存设置
          </button>
        </div>
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">论文 CSV 导入</h2>
        <input type="file" accept=".csv" onChange={(e) => e.target.files && uploadCsv(e.target.files[0])} />
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">组织管理</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submitOrg}>
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
            <li key={org.id}>
              {org.name} — {org.responsibility}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">角色模板</h2>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={submitRole}>
          <input
            className="border rounded px-3 py-2"
            placeholder="名称"
            value={roleForm.name}
            onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={roleForm.can_edit_vote_data}
              onChange={(e) => setRoleForm({ ...roleForm, can_edit_vote_data: e.target.checked })}
            />
            可编辑投票
          </label>
          <button className="bg-emerald-600 text-white px-4 py-2 rounded" type="submit">
            新建
          </button>
        </form>
        <ul className="mt-3 text-sm space-y-1">
          {roles.map((role) => (
            <li key={role.id}>
              {role.name} · {role.can_edit_vote_data ? "可编辑投票" : "只读"}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white p-6 rounded shadow overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3">用户角色与组织</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">姓名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>组织</th>
              <th>角色模板</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    className="border rounded px-2"
                  >
                    <option value="volunteer">志愿者</option>
                    <option value="admin">管理员</option>
                  </select>
                </td>
                <td>
                  <select
                    value={u.organization_id || 0}
                    onChange={(e) =>
                      updateUser(u.id, { organization_id: Number(e.target.value) || undefined })
                    }
                    className="border rounded px-2"
                  >
                    <option value={0}>未分配</option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={u.role_template_id || 0}
                    onChange={(e) =>
                      updateUser(u.id, { role_template_id: Number(e.target.value) || undefined })
                    }
                    className="border rounded px-2"
                  >
                    <option value={0}>无</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
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
