import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, login, register, error, setError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/labs", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);
    setError(null);

    if (!username || !password || (mode === "register" && !email)) {
      setLocalError("Заполните все поля");
      return;
    }

    setSubmitting(true);
    try {
      const result = mode === "login"
        ? await login(username, password)
        : await register(username, password, email);

      if (result) {
        navigate("/labs");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full  flex items-center justify-center p-4 ">
      <div className="w-full max-w-lg bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
        <div className="bg-slate-50 bg-white px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {mode === "login" ? "Вход" : "Регистрация"}
            </h1>
            <p className="text-sm text-slate-600">
              {mode === "login" ? "Введите данные для доступа" : "Создайте новый аккаунт"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {(localError || error) && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {localError || error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Логин</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Введите логин"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Введите пароль"
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Введите email"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-blue-600 text-white py-2 font-semibold hover:bg-blue-700 disabled:opacity-70"
          >
            {submitting ? "Сохранение..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>

          <div className="text-center text-sm text-slate-600">
            {mode === "login" ? (
              <>Нет аккаунта? <button type="button" className="text-blue-600 underline" onClick={() => setMode("register")}>Зарегистрироваться</button></>
            ) : (
              <>Уже есть аккаунт? <button type="button" className="text-blue-600 underline" onClick={() => setMode("login")}>Войти</button></>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
