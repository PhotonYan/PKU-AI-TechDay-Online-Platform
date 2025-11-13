import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Reimbursement {
  id: number;
  project_name: string;
  organization: string;
  content: string;
  quantity?: number;
  amount: number;
  invoice_company: string;
  file_path?: string;
  status: string;
  admin_note?: string;
  applicant_name?: string;
}

const statusMap: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  waiting_more: "等待补充材料",
};

const ReimbursementPage = () => {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [form, setForm] = useState({
    project_name: "",
    organization: "",
    content: "",
    quantity: "",
    amount: "",
    invoice_company: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadData = () => {
    if (!token) return;
    apiClient("/api/reimbursements", { token }).then(setItems);
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const resetForm = () => {
    setForm({ project_name: "", organization: "", content: "", quantity: "", amount: "", invoice_company: "" });
    setFile(null);
    setEditingId(null);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => value && body.append(key, value));
    if (file) body.append("file", file);
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/reimbursements/${editingId}` : "/api/reimbursements";
    await apiClient(url, { method, body, token });
    resetForm();
    loadData();
  };

  const editItem = (item: Reimbursement) => {
    setEditingId(item.id);
    setForm({
      project_name: item.project_name,
      organization: item.organization,
      content: item.content,
      quantity: String(item.quantity ?? ""),
      amount: String(item.amount),
      invoice_company: item.invoice_company,
    });
  };

  const deleteItem = async (id: number) => {
    if (!token) return;
    await apiClient(`/api/reimbursements/${id}`, { method: "DELETE", token });
    loadData();
  };

  const reviewItem = async (id: number, status: string) => {
    if (!token) return;
    await apiClient(`/api/reimbursements/${id}/review`, {
      method: "POST",
      token,
      body: JSON.stringify({ status }),
    });
    loadData();
  };

  return (
    <div className="grid gap-6">
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">{editingId ? "编辑报销" : "新建报销"}</h2>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submitForm}>
          {[
            { key: "project_name", label: "项目名称" },
            { key: "organization", label: "组织" },
            { key: "amount", label: "金额", type: "number" },
            { key: "invoice_company", label: "发票抬头公司" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium">{field.label}</label>
              <input
                type={field.type || "text"}
                className="mt-1 w-full border rounded px-3 py-2"
                value={(form as any)[field.key]}
                required
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">报销内容</label>
            <textarea
              className="mt-1 w-full border rounded px-3 py-2"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">数量（可选）</label>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              type="number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">发票文件</label>
            <input className="mt-1" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="md:col-span-2 flex space-x-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
              {editingId ? "保存修改" : "提交申请"}
            </button>
            {editingId && (
              <button type="button" className="border px-4 py-2 rounded" onClick={resetForm}>
                取消
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">我的报销</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">项目</th>
                <th>金额</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="py-2">
                    <div className="font-medium">{item.project_name}</div>
                    <div className="text-xs text-slate-500">{item.organization}</div>
                  </td>
                  <td>¥{item.amount}</td>
                  <td>{statusMap[item.status] || item.status}</td>
                  <td className="space-x-2">
                    {item.file_path && (
                      <a className="text-blue-600" href={item.file_path} target="_blank" rel="noreferrer">
                        文件
                      </a>
                    )}
                    {item.status !== "approved" && user?.role !== "admin" && (
                      <>
                        <button className="text-blue-600" onClick={() => editItem(item)}>
                          编辑
                        </button>
                        <button className="text-red-600" onClick={() => deleteItem(item.id)}>
                          删除
                        </button>
                      </>
                    )}
                    {user?.role === "admin" && (
                      <div className="flex flex-col space-y-1">
                        {Object.entries(statusMap).map(([key, label]) => (
                          <button
                            key={key}
                            className="text-xs border rounded px-2"
                            onClick={() => reviewItem(item.id, key)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="text-center text-slate-500 py-4">暂无报销记录</div>}
        </div>
      </div>
    </div>
  );
};

export default ReimbursementPage;
