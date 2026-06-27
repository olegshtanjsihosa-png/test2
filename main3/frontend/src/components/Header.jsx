import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

import { FlaskConical, BookOpen, BarChart3, User } from "lucide-react";

const nav = [
  { id: "guide", label: "Гайд", to: "/guide", icon: BookOpen },
  { id: "lab", label: "Лаба", to: "/labs", icon: FlaskConical },
  { id: "statistics", label: "Статистика", to: "/statistics", icon: BarChart3 },
];

export default function Header() {
  const location = useLocation();
  const activePath = location.pathname === "/labs" ? "lab" : location.pathname === "/" || location.pathname === "/guide" ? "guide" : location.pathname.replace("/", "");
  const { user, logout } = useAuth();

  return (
    <header className="h-[50px] border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
      <Link to="/" className="flex items-center gap-3 cursor-pointer">
        <div className="w-6 h-6 rounded bg-blue-600 grid place-items-center text-white text-[10px] font-bold">
          Σ
        </div>

        <div>
          <h1 className="text-[12px] font-semibold text-gray-800">
            Система обучения интерполяции
          </h1>
          <p className="text-[9px] text-gray-400">
            Интерполяция для начинающих
          </p>
        </div>
      </Link>


      <nav className="flex items-center gap-5">
        {user && nav.map(({ id, label, to, icon: Icon }) => {
          const active = activePath === id;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0 transition-colors ${
                active ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={13} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

    <div className="flex items-center">
      {user ? (
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white shadow-sm">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
            {user.username?.[0]?.toUpperCase() ?? "U"}
          </div>

          <div className="leading-tight">
            <p className="text-[12px] font-semibold text-gray-800">
              {user.username}
            </p>

            <p className="text-[10px] text-gray-400">
              {user.email || "Пользователь"}
            </p>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          <button
            type="button"
            onClick={logout}
            className="
              text-[11px]
              font-medium
              text-red-500
              hover:text-red-600
              transition-colors
            "
          >
            Выйти
          </button>
        </div>
      ) : (
        <Link
          to="/login"
          className="
            flex items-center gap-2
            px-3 py-1.5
            rounded-xl
            hover:border-blue-300
            hover:bg-blue-50
            transition-all
            text-[12px]
            text-blue-600
          "
        >
          <User size={14} />
          <span>Войти</span>
        </Link>
      )}
    </div>
    </header>
  );
}
