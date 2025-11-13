import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

const VolunteerProfilePage = () => {
  const { token } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    apiClient("/api/volunteers/me", { token }).then(setProfile);
  }, [token]);

  if (!profile) return <div>加载中...</div>;

  return (
    <div className="bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">个人信息</h1>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {([
          ["姓名", profile.name],
          ["邮箱", profile.email],
          ["学院", profile.college],
          ["界别", profile.grade],
          ["志愿方向", (profile.volunteer_tracks || []).join("、")],
          ["可服务时段", (profile.availability_slots || []).join("、")],
          ["组织", profile.organization || "待分配"],
          ["职责", profile.responsibility || "由管理员分配"],
        ] as const).map(([label, value]) => (
          <div key={label} className="bg-slate-50 p-3 rounded">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-800">{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default VolunteerProfilePage;
