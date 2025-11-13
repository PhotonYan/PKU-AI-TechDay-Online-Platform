import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

const timeSlots = ["13:00", "14:00", "15:00", "16:00", "17:00"];

interface Organization {
  id: number;
  name: string;
  responsibility: string;
}

const VolunteerRegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    college: "",
    grade: "",
    student_id: "",
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgNames, setSelectedOrgNames] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voteCounter, setVoteCounter] = useState(false);

  useEffect(() => {
    apiClient("/api/volunteers/organizations")
      .then(setOrganizations)
      .catch((err) => setError(err.message));
  }, []);

  const toggleOrg = (name: string) => {
    setSelectedOrgNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const toggleSlot = (slot: string) => {
    setSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      await apiClient("/api/volunteers/register", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          volunteer_tracks: selectedOrgNames,
          availability_slots: slots,
          vote_counter_opt_in: voteCounter,
        }),
      });
      setMessage("报名成功，正在跳转到登录页...");
      setTimeout(() => navigate("/login?registered=1", { replace: true }), 800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">志愿者报名</h1>
      {message && <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
      <form className="grid gap-4" onSubmit={handleSubmit}>
        {[
          { key: "name", label: "姓名" },
          { key: "email", label: "邮箱", type: "email" },
          { key: "password", label: "密码", type: "password" },
          { key: "college", label: "学院" },
          { key: "grade", label: "届别" },
          { key: "student_id", label: "学号" },
        ].map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium">{field.label}</label>
            <input
              type={field.type || "text"}
              className="mt-1 w-full border rounded px-3 py-2"
              required
              value={(form as any)[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <div className="text-sm font-medium mb-1">报名工作组（可多选）</div>
          <div className="flex flex-wrap gap-2">
            {organizations.length === 0 && <span className="text-xs text-slate-500">管理员尚未配置工作组</span>}
            {organizations.map((org) => (
              <button
                type="button"
                key={org.id}
                className={`px-3 py-1 border rounded text-sm ${
                  selectedOrgNames.includes(org.name) ? "bg-blue-600 text-white" : ""
                }`}
                onClick={() => toggleOrg(org.name)}
              >
                {org.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">可服务时段（13:00-18:00）</div>
          <div className="flex flex-wrap gap-2">
            {timeSlots.map((slot) => (
              <button
                type="button"
                key={slot}
                className={`px-3 py-1 border rounded ${slots.includes(slot) ? "bg-emerald-600 text-white" : ""}`}
                onClick={() => toggleSlot(slot)}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={voteCounter} onChange={(e) => setVoteCounter(e.target.checked)} />
          报名计票志愿者
        </label>
        <button type="submit" className="bg-blue-600 text-white py-2 rounded disabled:opacity-60" disabled={submitting}>
          {submitting ? "提交中..." : "提交报名"}
        </button>
      </form>
    </div>
  );
};

export default VolunteerRegisterPage;
