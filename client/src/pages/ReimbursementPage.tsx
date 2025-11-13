import { FormEvent, Fragment, useEffect, useState } from "react";
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
  approved: "通过",
  rejected: "拒绝",
  waiting_more: "等待补充材料",
};
const reviewOptions = Object.entries(statusMap).filter(([key]) => key !== "pending");
const statusBadge: Record<string, string> = {
  approved: "text-emerald-700",
  rejected: "text-red-600",
  waiting_more: "text-blue-600",
  pending: "text-slate-700",
};
const reviewButtonClass: Record<string, string> = {
  approved: "bg-emerald-50 border-emerald-200 text-emerald-700",
  rejected: "bg-red-50 border-red-200 text-red-700",
  waiting_more: "bg-blue-50 border-blue-200 text-blue-700",
};

type Feedback = { type: "success" | "error"; text: string } | null;

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
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadData = () => {
    if (!token) return;
    apiClient("/api/reimbursements", { token })
      .then(setItems)
      .catch((err) => setFeedback({ type: "error", text: err.message }));
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
    setSubmitting(true);
    setFeedback(null);
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => value && body.append(key, value));
    if (file) body.append("file", file);
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/reimbursements/${editingId}` : "/api/reimbursements";
    try {
      await apiClient(url, { method, body, token });
      resetForm();
      setFeedback({ type: "success", text: editingId ? "报销更新成功" : "报销提交成功" });
      loadData();
    } catch (err) {
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
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
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiClient(`/api/reimbursements/${id}`, { method: "DELETE", token });
      setFeedback({ type: "success", text: "报销已删除" });
      loadData();
    } catch (err) {
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const reviewItem = async (id: number, status: string) => {
    if (!token) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiClient(`/api/reimbursements/${id}/review`, {
        method: "POST",
        token,
        body: JSON.stringify({ status }),
      });
      setFeedback({ type: "success", text: "审批状态已更新" });
      setReviewingId(null);
      loadData();
    } catch (err) {
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6">
      {feedback && (
        <div
          className={`border px-4 py-2 rounded text-sm ${
            feedback.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {feedback.text}
        </div>
      )}
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
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60" disabled={submitting}>
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
                <th>内容</th>
                <th>申请人</th>
                <th>状态</th>
                <th>附件</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr className="border-t">
                    <td className="py-2 cursor-pointer" onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}>
                      <div className="font-medium">{item.project_name}</div>
                      <div className="text-xs text-slate-500">{item.organization}</div>
                    </td>
                    <td>¥{item.amount}</td>
                    <td className="text-sm text-slate-600">
                      {item.content.length > 40 ? `${item.content.slice(0, 40)}...` : item.content}
                    </td>
                    <td>{item.applicant_name || "本人"}</td>
                    <td className={`${statusBadge[item.status] || "text-slate-700"} font-medium`}>
                      {statusMap[item.status] || item.status}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {item.file_path ? (
                        <a className="text-blue-600" href={item.file_path} target="_blank" rel="noreferrer">
                          查看
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="space-x-2" onClick={(e) => e.stopPropagation()}>
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
                          {item.status === "pending" ? (
                            reviewOptions.map(([key, label]) => (
                            <button
                              key={key}
                              className={`text-xs border rounded px-2 disabled:opacity-60 ${reviewButtonClass[key] || ""}`}
                              disabled={submitting}
                              onClick={() => reviewItem(item.id, key)}
                            >
                              {label}
                            </button>
                          ))
                        ) : reviewingId === item.id ? (
                          <>
                            {reviewOptions.map(([key, label]) => (
                              <button
                                key={key}
                                className={`text-xs border rounded px-2 disabled:opacity-60 ${reviewButtonClass[key] || ""}`}
                                disabled={submitting}
                                onClick={() => reviewItem(item.id, key)}
                              >
                                {label}
                              </button>
                              ))}
                              <button className="text-xs border rounded px-2" onClick={() => setReviewingId(null)}>
                                收起
                              </button>
                            </>
                          ) : (
                            <button
                              className="text-xs border rounded px-2"
                              onClick={() => setReviewingId((prev) => (prev === item.id ? null : item.id))}
                            >
                              修改
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-4 py-3 text-sm">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <div className="text-slate-500 text-xs">报销内容</div>
                            <div className="font-medium">{item.content}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs">数量</div>
                            <div>{item.quantity ?? "-"}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs">发票抬头公司</div>
                            <div>{item.invoice_company}</div>
                          </div>
                          {/* <div>
                            <div className="text-slate-500 text-xs">管理员备注</div>
                            <div>{item.admin_note || "—"}</div>
                          </div> */}
                          <div className="md:col-span-2">
                            <div className="text-slate-500 text-xs">附件</div>
                            {item.file_path ? (
                              <a className="text-blue-600" href={item.file_path} target="_blank" rel="noreferrer">
                                查看上传文件
                              </a>
                            ) : (
                              <div>无</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
