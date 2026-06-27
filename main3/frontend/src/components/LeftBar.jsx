import { useState, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export default function LeftBar({ onSelectLab, selectedLabId: externalSelectedLabId, onSelectTitles, onLabsChange, moduleId = 1 }) {
  const [modules, setModules] = useState([]);
  const [labs, setLabs] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState(moduleId);
  const [internalSelectedLabId, setInternalSelectedLabId] = useState(null);

  const selectedLabId = externalSelectedLabId !== undefined ? externalSelectedLabId : internalSelectedLabId;

  useEffect(() => {
    const fetchModules = async () => {
      const response = await fetch(`${API_BASE}/modules/`, {
        credentials: 'include',
      });
      const data = await response.json();
      setModules(data.results || []);
      if (data.results && data.results.length > 0 && !selectedModuleId) {
        setSelectedModuleId(data.results[0].id);
      }
    };

    fetchModules();
  }, []);

  useEffect(() => {
    if (!selectedModuleId) return;

    const fetchLabs = async () => {
      const response = await fetch(`${API_BASE}/modules/${selectedModuleId}/laboratory-works/`, {
        credentials: 'include',
      });
      const data = await response.json();
      const labList = Array.isArray(data) ? data : data.results || [];
      setLabs(labList);
      onLabsChange?.(labList);

      if ((externalSelectedLabId === undefined || externalSelectedLabId === null) && labList.length > 0 && !internalSelectedLabId) {
        const firstLabId = labList[0].id;
        setInternalSelectedLabId(firstLabId);
        onSelectLab?.(firstLabId);
      }
    };

    fetchLabs();
  }, [selectedModuleId, externalSelectedLabId, onSelectLab, onLabsChange]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await fetch(`${API_BASE}/results/`, {
          credentials: 'include',
        });
        const data = await response.json();
        setResults(Array.isArray(data) ? data : data.results || []);
      } catch (error) {
        console.warn('Не удалось загрузить прогресс результатов', error);
      }
    };

    fetchResults();
    window.addEventListener('results-updated', fetchResults);
    return () => window.removeEventListener('results-updated', fetchResults);
  }, []);

  useEffect(() => {
    if (!onSelectTitles) return;

    const moduleTitle = modules.find((m) => m.id === selectedModuleId)?.title || '';
    const labTitle = labs.find((l) => l.id === selectedLabId)?.title || '';

    onSelectTitles({ moduleTitle, labTitle });
  }, [modules, labs, selectedModuleId, selectedLabId, onSelectTitles]);

  const getLabProgress = (lab) => {
    const relevantResults = results.filter(
      (result) => result.element_type_binding_data?.laboratory_work_title === lab.title
    );

    if (relevantResults.length === 0) {
      return { progress: 0, passedCount: 0, totalCount: 0 };
    }

    const passedCount = relevantResults.filter((result) => result.is_passed).length;
    return {
      progress: Math.round((passedCount / relevantResults.length) * 100),
      passedCount,
      totalCount: relevantResults.length,
    };
  };

  const moduleProgress = useMemo(() => {
    if (!labs.length) {
      return { percent: 0, completedLabCount: 0, totalLabCount: 0 };
    }

    const stats = labs.map(getLabProgress);
    const totalProgress = stats.reduce((sum, item) => sum + item.progress, 0);
    const completedLabCount = stats.filter((item) => item.progress === 100).length;

    return {
      percent: Math.round(totalProgress / stats.length),
      completedLabCount,
      totalLabCount: labs.length,
    };
  }, [labs, results]);
  
  const handleSelectModule = (moduleId) => {
    setSelectedModuleId(moduleId);
    setInternalSelectedLabId(null);
    onSelectLab?.(undefined);
  };
  
  const handleSelectLab = (labId) => {
    if (externalSelectedLabId === undefined) {
      setInternalSelectedLabId(labId);
    }
    onSelectLab?.(labId);
  };
  
  return (
    <div className="w-[16vw] gap-1 flex flex-col shrink-0 h-full min-h-full">
      <div className="bg-white flex-grow flex flex-col rounded-md-custom p-4 border border-gray-200">
        <div className="mb-4">
          <p className="text-body font-semibold mb-2">Модуль</p>
          {modules && modules.length > 1 ? (
            <div className="w-full h-8 rounded-md-custom border border-gray-200 bg-white px-2 flex items-center">
              <select 
                className="w-full bg-transparent outline-none text-body p-1"
                value={selectedModuleId}
                onChange={(e) => handleSelectModule(Number(e.target.value))}
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
              <ChevronDown size={14} className="text-gray-400 ml-2" />
            </div>
          ) : (
            <div className="text-body">{modules[0]?.title || "Нет модулей"}</div>
          )}
        </div>
        <div>
          <p className="text-body font-semibold mb-2">Лабораторные работы</p>
          
          <ol className="flex flex-col bg-white rounded overflow-hidden border border-gray-200">
            {labs.map((lab) => {
              const isSelected = lab.id === selectedLabId;
              const { progress } = getLabProgress(lab);
              
              return (
                <li
                  key={lab.id}
                  onClick={() => handleSelectLab(lab.id)}
                  className={`border-b last:border-b-0 py-3 px-3 cursor-pointer ${
                    isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <p className={`text-body leading-tight ${isSelected ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                      {lab.position || lab.id}. {lab.title}
                    </p>
                    
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-caption w-8 ${isSelected ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>
                        {progress}%
                      </span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isSelected ? 'bg-blue-600' : 'bg-gray-400'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="w-full flex bg-white border border-gray-200 items-center p-4 gap-2 flex-col rounded-md-custom">
        <div className="text-center">
          <h3 className="text-body font-semibold text-gray-800">Общий прогресс</h3>
        </div>
        
        <div className="flex justify-center flex-1 items-center w-full">
          <div className="relative w-3/4 h-3/4">
            <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#2563eb"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 52 * (moduleProgress.percent / 100)} ${2 * Math.PI * 52 * (1 - moduleProgress.percent / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-gray-800">{moduleProgress.percent}%</span>
            </div>
          </div>
        </div>
        
        <div className="text-center text-caption text-gray-500">
          {moduleProgress.completedLabCount} из {moduleProgress.totalLabCount} лабораторных работ
        </div>
      </div>
    </div>
  );
}
