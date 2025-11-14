import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import PaperListPage from "./pages/PaperListPage";
import PaperDetailPage from "./pages/PaperDetailPage";
import ReimbursementPage from "./pages/ReimbursementPage";
import VolunteerRegisterPage from "./pages/VolunteerRegisterPage";
import VolunteerProfilePage from "./pages/VolunteerProfilePage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AuthorRegisterPage from "./pages/AuthorRegisterPage";
import AuthorProfilePage from "./pages/AuthorProfilePage";
import AuthorSubmissionFormPage from "./pages/AuthorSubmissionFormPage";
import AdminExhibitPage from "./pages/AdminExhibitPage";

const RequireAuth = ({ children, roles }: { children: JSX.Element; roles?: string[] }) => {
  const { token, user } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const App = () => {
  const { user, logout } = useAuth();
  const profileLink = user?.role === "author" ? "/author/profile" : "/volunteer/profile";
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <nav className="space-x-4 text-sm font-medium">
            <Link to="/">成果展示</Link>
            {user && user.role !== "author" && <Link to="/reimbursements">报销管理</Link>}
            {user?.role === "author" && (
              <>
                <Link to="/author/profile">作者中心</Link>
                <Link to="/author/submissions/new">上传作品</Link>
              </>
            )}
            {user?.role === "admin" && (
              <>
                <Link to="/admin/settings">后台管理</Link>
                <Link to="/admin/exhibits">参展管理</Link>
              </>
            )}
          </nav>
          <div className="text-sm">
            {user ? (
              <div className="flex items-center space-x-3">
                <Link to={profileLink} className="text-slate-800 font-medium">
                  {user.name}（{user.role}）
                </Link>
                <button className="text-blue-600" onClick={logout}>
                  退出
                </button>
              </div>
            ) : (
              <Link className="text-blue-600" to="/login">
                登录
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<PaperListPage />} />
          <Route path="/papers/:id" element={<PaperDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/author/register" element={<AuthorRegisterPage />} />
          <Route
            path="/reimbursements"
            element={
              <RequireAuth roles={["volunteer", "admin"]}>
                <ReimbursementPage />
              </RequireAuth>
            }
          />
          <Route path="/volunteer/register" element={<VolunteerRegisterPage />} />
          <Route
            path="/volunteer/profile"
            element={
              <RequireAuth roles={["volunteer", "admin"]}>
                <VolunteerProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/author/profile"
            element={
              <RequireAuth roles={["author"]}>
                <AuthorProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/author/submissions/new"
            element={
              <RequireAuth roles={["author"]}>
                <AuthorSubmissionFormPage />
              </RequireAuth>
            }
          />
          <Route
            path="/author/submissions/:id/edit"
            element={
              <RequireAuth roles={["author"]}>
                <AuthorSubmissionFormPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <RequireAuth roles={["admin"]}>
                <AdminSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/exhibits"
            element={
              <RequireAuth roles={["admin"]}>
                <AdminExhibitPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </div>
  );
};

export default App;
