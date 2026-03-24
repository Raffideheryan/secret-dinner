import Layout from "./components/Layout/Layout";
import { Route, Routes } from "react-router-dom";
import Home from "./components/Home/Home";
import AdminLogin from "./components/Admin/AdminLogin";
import AdminPanel from "./components/Admin/AdminPanel";
import ProtectedAdminRoute from "./components/Admin/ProtectedAdminRoute";
import Join from "./components/Join/Join"
import JoinDinners from "./components/Join/ChooseDinner"
import JoinFormGuard from "./components/Join/JoinFormGuard";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          
        </Route>
        <Route path="/join" element={<Join />} />
        <Route
            path="/join/dinners"
            element={
              <JoinFormGuard>
                <JoinDinners />
              </JoinFormGuard>
            }
          />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminPanel />
            </ProtectedAdminRoute>
          }
        />
      </Routes>
    </>
  );
}
