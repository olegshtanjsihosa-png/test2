import { useEffect, useState } from "react";
import { useAuth } from "../auth";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export default function PageStatistics() {
  const { user, loading: authLoading } = useAuth();

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setResults([]);
      setLoading(false);
      return;
    }

    async function fetchResults() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/results/`, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
            data.message ||
            "Не удалось загрузить результаты"
          );
        }

        if (Array.isArray(data)) {
          setResults(data);
        } else if (Array.isArray(data.results)) {
          setResults(data.results);
        } else {
          setResults([]);
          setError("Сервер вернул неожиданный формат данных");
        }
      } catch (err) {
        setError(err.message || "Ошибка загрузки результатов");
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
    window.addEventListener("results-updated", fetchResults);
    return () => window.removeEventListener("results-updated", fetchResults);
  }, [user]);

  const items = Array.isArray(results) ? results : [];

  if (authLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="rounded-md-custom border border-gray-200 bg-white px-6 py-4 text-center">
          <p>Загрузка пользователя...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="rounded-md-custom border border-gray-200 bg-white p-8 text-center">
          <h1 className="mb-2">Статистика</h1>

          <p className="text-body">
            Пожалуйста, войдите в систему, чтобы увидеть свои результаты.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex border border-gray-200 rounded-md-custom overflow-hidden bg-white">
      <div className="w-full flex flex-col">
        <div className="text-center p-6">
          <h1>Статистика</h1>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-0">

          {loading ? (
            <div className="rounded-md-custom border border-gray-200 bg-gray-50 p-6 text-center">
              <p>Загрузка результатов...</p>
            </div>

          ) : error ? (
            <div className="rounded-md-custom border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-red-700">{error}</p>
            </div>

          ) : items.length === 0 ? (
            <div className="rounded-md-custom border border-gray-200 bg-gray-50 p-6 text-center">
              <h3>Результатов пока нет</h3>

              <p className="text-body mt-1">
                После прохождения лабораторных работ здесь появится статистика.
              </p>
            </div>

          ) : (
            <div className="overflow-auto w-3/4 mx-auto rounded-md-custom border border-gray-200 bg-white">

              <table className="w-full border-collapse text-left">

                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">

                    <th className="px-4 py-3 text-[13px] font-semibold text-gray-800">
                      Лабораторная работа
                    </th>

                    <th className="px-4 py-3 text-[13px] font-semibold text-gray-800">
                      Элемент
                    </th>

                    <th className="px-4 py-3 text-center text-[13px] font-semibold text-gray-800">
                      Статус
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((result) => {
                    const binding = result.element_type_binding_data ?? {};

                    return (
                      <tr
                        key={result.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >

                        <td className="px-4 py-3 text-sm text-gray-600">
                          {binding.laboratory_work_title || "-"}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-600">
                          {binding.lab_element_title || "-"}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {result.is_passed ? (
                            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                              Пройдено
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                              Не пройдено
                            </span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
