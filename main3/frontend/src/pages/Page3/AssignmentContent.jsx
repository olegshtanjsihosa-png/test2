import { useState, useEffect, useCallback, useRef } from "react";
import GraphPanel from "./GraphPanel";
import StepContent from "./AssignmentStepContent";
import { normalizeAssignmentData } from "./contentData";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const ErrorMessage = ({ children }) => (
  <div className="p-2 rounded bg-red-50 text-red-700 text-xs">{children}</div>
);

const getCsrfToken = () => {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('csrftoken='))
    ?.split('=')[1];
};

function StepRenderer({ step, idx, total, variables, answers, onAnswerChange, onSkip, onNext, onPrev, onComplete, isCompleted, stepIsValid, onStepValidated }) {
  const [isValid, setIsValid] = useState(Boolean(stepIsValid || isCompleted));
  const isLastStep = idx === total - 1;
  
  useEffect(() => {
    setIsValid(Boolean(stepIsValid || isCompleted));
  }, [step.id, stepIsValid, isCompleted]);

  const handleValidated = useCallback((valid) => {
    setIsValid(valid);
    onStepValidated?.(step.id, valid);
  }, [onStepValidated, step.id]);
  
  const handleSkip = () => {
    onSkip?.(step.id);
    handleValidated(true);
  };
  
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center pb-2 border-b">
        <div className="text-[10px] text-gray-400">Шаг {idx+1}/{total}</div>
        <button 
          onClick={handleSkip}
          className="hidden px-2 py-0.5 rounded text-xs text-gray-400 hover:bg-gray-100 transition-colors"
        >
          Пропустить
        </button>
      </div>
      
      <h2 className="text-base font-semibold">{step.title}</h2>
      
      <StepContent 
        step={step} 
        variables={variables} 
        answers={answers} 
        onAnswerChange={onAnswerChange} 
        onTestsValidated={handleValidated}
      />
      
      <div className="flex flex-col gap-2 pt-3 border-t sm:flex-row">
        <button 
          onClick={onPrev} 
          disabled={idx === 0} 
          className="flex-1 py-1.5 rounded border text-xs disabled:opacity-50 hover:bg-gray-50 transition-colors"
        >
          Назад
        </button>
        <button 
          onClick={onNext} 
          disabled={!isValid && !isCompleted} 
          className={`flex-1 py-1.5 rounded bg-blue-600 text-white text-xs disabled:opacity-50 hover:bg-blue-700 transition-colors ${isLastStep ? "hidden" : ""}`}
        >
          {isLastStep ? "Далее" : "Далее"}
        </button>
        {isLastStep && (
          <button
            onClick={onComplete}
            disabled={(!isValid && !isCompleted) || isCompleted}
            className="flex-1 py-1.5 rounded bg-emerald-600 text-white text-xs disabled:opacity-50 hover:bg-emerald-700 transition-colors"
          >
            {isCompleted ? "Уже пройдено" : "Завершить"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AssignmentContent({ labId, initialData = null, loading: externalLoading = false, error: externalError = null, onRefresh, stepIdx = 0, answers = {}, onStepChange, onAnswersChange, onComplete }) {
  const normalizedInitialData = normalizeAssignmentData(initialData);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(normalizedInitialData);
  const [hoverPoint, setHoverPoint] = useState(null);
  const [resultId, setResultId] = useState(normalizedInitialData?.result_id || null);
  const [resultIsPassed, setResultIsPassed] = useState(Boolean(normalizedInitialData?.result_is_passed));
  const [validatedSteps, setValidatedSteps] = useState({});
  const [hasLoaded, setHasLoaded] = useState(Boolean(initialData));
  const dataCacheRef = useRef({});

  const currentStepIdx = stepIdx ?? 0;
  const currentAnswers = answers || {};

  const updateStepIdx = useCallback((value) => {
    onStepChange?.(value);
  }, [onStepChange]);

  const handleAnswerChange = useCallback((id, value) => {
    onAnswersChange?.((prev = {}) => ({ ...prev, [id]: value }));
  }, [onAnswersChange]);

  const handleStepValidated = useCallback((stepId, valid) => {
    setValidatedSteps((prev) => ({ ...prev, [stepId]: valid }));
  }, []);

  const steps = data?.steps || [];
  const step = steps[currentStepIdx];
  const vars = data?.generated_variables || {};
  const funcs = data?.functions || [];
  
  const handleComplete = useCallback(async () => {
    if (!resultId) return;

    try {
      const response = await fetch(`${API_BASE}/results/${resultId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken() || ''
        },
        body: JSON.stringify({ is_passed: true })
      });

      if (!response.ok) {
        throw new Error('Не удалось обновить прогресс');
      }

      const updated = await response.json();
      setResultIsPassed(Boolean(updated.is_passed));
      window.dispatchEvent(new Event('results-updated'));
      if (currentStepIdx < steps.length - 1) {
        updateStepIdx(currentStepIdx + 1);
      } else {
        onComplete?.();
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Ошибка при завершении задания');
    }
  }, [resultId, currentStepIdx, steps.length, updateStepIdx, onComplete]);

  const loadLabData = useCallback(async (currentLabId, { force = false } = {}) => {
    if (!currentLabId) {
      setData(null);
      setValidatedSteps({});
      setHasLoaded(false);
      return;
    }

    if (!force && dataCacheRef.current[currentLabId]) {
      const cached = dataCacheRef.current[currentLabId];
      setData(cached);
      setResultId(cached.result_id || null);
      setResultIsPassed(Boolean(cached.result_is_passed));
      setValidatedSteps({});
      setHasLoaded(true);
      return;
    }

    setLoading(true);
    if (force) setData(null);

    try {
      const response = await fetch(`${API_BASE}/laboratory-works/${currentLabId}/with_data/`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Не удалось загрузить данные');
      }

      const d = normalizeAssignmentData(await response.json());
      if (!d.success) {
        throw new Error(d.message || 'Ошибка API');
      }

      dataCacheRef.current[currentLabId] = d;
      setData(d);
      setResultId(d.result_id || null);
      setResultIsPassed(Boolean(d.result_is_passed));
      setValidatedSteps({});
      setHasLoaded(true);
    } catch (e) {
      setData({ error: e.message });
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialData) {
      const normalized = normalizeAssignmentData(initialData);
      setData(normalized);
      setResultId(normalized?.result_id || null);
      setResultIsPassed(Boolean(normalized?.result_is_passed));
      setValidatedSteps({});
      setHasLoaded(true);
      return;
    }

    if (!labId) {
      setData(null);
      setValidatedSteps({});
      setHasLoaded(false);
      return;
    }

    if (externalLoading) {
      return;
    }

    loadLabData(labId);
  }, [labId, initialData, externalLoading, loadLabData]);
  
  const handleRefresh = () => {
    if (!labId) return;
    if (onRefresh) {
      onRefresh();
      return;
    }
    loadLabData(labId, { force: true });
  };
  
  const effectiveLoading = loading || externalLoading;
  const effectiveError = data?.error || externalError;

  if (effectiveLoading && !hasLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (effectiveError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <ErrorMessage>Есть ошибки. Проверьте вопросы, выделенные красным.</ErrorMessage>
          <button
            onClick={handleRefresh}
            disabled={effectiveLoading}
            className="mt-4 px-4 py-2 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {effectiveLoading ? "Загрузка..." : "Попытаться снова"}
          </button>
        </div>
      </div>
    );
  }
  
  if (!data || !steps.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">Нет данных для отображения</p>
          <button
            onClick={handleRefresh}
            disabled={effectiveLoading}
            className="px-4 py-2 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {effectiveLoading ? "Загрузка..." : "Загрузить задание"}
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 h-full flex rounded-b border border-gray-200 overflow-hidden flex-col lg:flex-row">
      <div className="flex-1 flex flex-col bg-white border-r">
        <div className="p-3 pb-1">
          <div className="rounded bg-gray-50 border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className=" font-bold text-[12px] text-gray-400 uppercase">
                  {data.element?.type === "training" ? "Цель" : "Практика"}
                </div>
                <h1 className="text-caption">
                  {data.element?.title || step?.description || step?.title || "Обучающее задание"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={effectiveLoading}
                  className="px-3 py-1 rounded border border-gray-300 text-xs hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  title="Обновить задание"
                >
                  {effectiveLoading ? "Загрузка..." : "Обновить"}
                </button>
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${resultIsPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {resultIsPassed ? 'Пройдено' : 'Не пройдено'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-[350px] p-3">
          <div className="relative h-full rounded border overflow-hidden">
            {hoverPoint && (
              <div className="absolute right-2 top-2 z-10 rounded bg-white border px-2 py-1 text-xs shadow">
                <div className="font-semibold">Точка {hoverPoint.label}</div>
                <div>x = {hoverPoint.x}</div>
                <div>y = {hoverPoint.y}</div>
              </div>
            )}
            <GraphPanel
              graph={step?.graph}
              functions={funcs}
              variables={vars}
              onHoverPoint={setHoverPoint}
            />
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[500px] overflow-y-auto bg-white p-4">
          {loading && hasLoaded ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : step ? (
            <StepRenderer
              step={step}
              idx={currentStepIdx}
              total={steps.length}
              variables={vars}
              answers={currentAnswers}
              onAnswerChange={handleAnswerChange}
              onSkip={() => {}}
              onNext={() => currentStepIdx < steps.length - 1 && updateStepIdx(currentStepIdx + 1)}
              onPrev={() => currentStepIdx > 0 && updateStepIdx(currentStepIdx - 1)}
              onComplete={handleComplete}
              isCompleted={resultIsPassed}
              stepIsValid={Boolean(validatedSteps[step.id])}
              onStepValidated={handleStepValidated}
            />
          ) : null}
      </div>
    </div>
  );
}





