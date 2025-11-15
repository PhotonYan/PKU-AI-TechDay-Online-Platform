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
import ReviewerRegisterPage from "./pages/ReviewerRegisterPage";
import AwardsManagementPage from "./pages/AwardsManagementPage";

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
  const profileLink =
    user?.role === "author"
      ? "/author/profile"
      : user?.role && ["volunteer", "admin"].includes(user.role)
      ? "/volunteer/profile"
      : null;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="https://www.ai.pku.edu.cn/" target="_blank" rel="noreferrer" className="flex items-center gap-2">
              <img src="/iai.png" alt="IAI Logo" className="h-10 w-auto object-contain" />
              <span className="sr-only">IAI 官网</span>
            </a>
            <div className="text-lg font-semibold text-slate-800 flex items-center gap-4">
              <Link to="/">AI TechDay Online Platform</Link>
              <span className="h-6 w-px bg-slate-300" aria-hidden="true" />
            </div>
            <nav className="space-x-4 text-sm font-medium">
              <Link to="/">成果展示</Link>
              {user && ["volunteer", "admin"].includes(user.role) && <Link to="/reimbursements">报销管理</Link>}
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
              {user && ["admin", "reviewer"].includes(user.role) && <Link to="/awards">奖项管理</Link>}
            </nav>
          </div>
          <div className="text-sm">
            {user ? (
              <div className="flex items-center space-x-3">
                {profileLink ? (
                  <Link to={profileLink} className="text-slate-800 font-medium">
                    {user.name}（{user.role}）
                  </Link>
                ) : (
                  <span className="text-slate-800 font-medium">
                    {user.name}（{user.role}）
                  </span>
                )}
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
          <Route path="/reviewer/register" element={<ReviewerRegisterPage />} />
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
          <Route
            path="/awards"
            element={
              <RequireAuth roles={["admin", "reviewer"]}>
                <AwardsManagementPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </div>
  );
};

export default App;
