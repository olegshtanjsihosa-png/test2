import { FlaskConical, GraduationCap, Sigma } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="w-full h-full flex-col justify-start flex overflow-hidden items-stretch">
      <div className="shrink-0 flex m-auto border px-6 border-gray-200 rounded-md-custom h-auto w-[660px] flex-col bg-white overflow-hidden">
        <div className="shrink-0 flex flex-col items-center justify-center gap-3 pt-8 pb-6 border-b border-gray-100">
          <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <Sigma size={28} className="text-white" />
          </div>
          <div className="text-center">
            <h1>Система обучения интерполяции</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">Интерполяция для начинающих</p>
          </div>
        </div>

        <div className="pt-6 pb-2">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-blue-600" />
            <h2>Добро пожаловать!</h2>
          </div>

          <p>
            Система предназначена для изучения численных методов интерполяции.
          </p>
        </div>

        <div className="py-3">
          <div className="flex items-center gap-2 mb-2">
            <h2>Как это работает</h2>
          </div>

          <p>
            Выберите лабораторную работу, изучите теоретический материал и выполните обучающие задания.
            После подготовки вы сможете перейти к самостоятельному выполнению работы и проверке результатов.
          </p>
        </div>

        <div className="py-3">
          <div className="flex items-center gap-2 mb-2">
            <h2>Что нужно для начала</h2>
          </div>

          <p>
            Для начала обучения потребуются базовые знания по математике и численным методам.
            Если у вас ещё нет аккаунта, авторизуйтесь или зарегистрируйтесь.
          </p>
        </div>

        <div className="py-6 mt-2 border-t border-gray-100">
          <button 
            onClick={() => navigate(user ? "/labs" : "/login")}
            className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            <FlaskConical size={16} />
            <span>{user ? "Перейти к обучению" : "Авторизоваться / Зарегистрироваться"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
