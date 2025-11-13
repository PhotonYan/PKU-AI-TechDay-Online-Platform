import { FormEvent, useState } from "react";
import { apiClient } from "../api/client";

const tracks = ["志愿I", "志愿II", "志愿III"];
const timeSlots = ["13:00", "14:00", "15:00", "16:00", "17:00"];

const VolunteerRegisterPage = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    college: "",
    grade: "",
  });
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const toggleTrack = (track: string) => {
    setSelectedTracks((prev) => (prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track]));
  };

  const toggleSlot = (slot: string) => {
    setSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    await apiClient("/api/volunteers/register", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        volunteer_tracks: selectedTracks,
        availability_slots: slots,
      }),
    });
    setMessage("报名成功，请登录后查看个人信息");
  };

  return (
    <div className="bg-white p-6 rounded shadow max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">志愿者报名</h1>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        {[
          { key: "name", label: "姓名" },
          { key: "email", label: "邮箱", type: "email" },
          { key: "password", label: "密码", type: "password" },
          { key: "college", label: "学院" },
          { key: "grade", label: "界别" },
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
          <div className="text-sm font-medium mb-1">志愿方向</div>
          <div className="flex flex-wrap gap-2">
            {tracks.map((track) => (
              <button
                type="button"
                key={track}
                className={`px-3 py-1 border rounded ${selectedTracks.includes(track) ? "bg-blue-600 text-white" : ""}`}
                onClick={() => toggleTrack(track)}
              >
                {track}
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
        <button type="submit" className="bg-blue-600 text-white py-2 rounded">
          提交报名
        </button>
        {message && <p className="text-sm text-green-600">{message}</p>}
      </form>
    </div>
  );
};

export default VolunteerRegisterPage;
