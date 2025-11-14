import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@techday.local");
  const [password, setPassword] = useState("AdminPass123");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("registered") === "1") {
      setInfo("注册成功，请使用邮箱密码登录");
    }
  }, [location.search]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow space-y-4">
      <h1 className="text-xl font-semibold mb-4">登录</h1>
      {info && <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">{info}</div>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium">邮箱</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">密码</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
          登录
        </button>
      </form>
      <div className="text-center text-sm text-slate-600 space-y-1">
        <div>
          还没有账号？
          <Link className="text-blue-600 ml-1" to="/volunteer/register">
            注册为志愿者
          </Link>
        </div>
        <div>
          想投稿参展？
          <Link className="text-blue-600 ml-1" to="/author/register">
            作者注册
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
