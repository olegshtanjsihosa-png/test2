import { useState, useEffect, useCallback, useRef } from "react";
import LeftBar from "../../components/LeftBar";
import Page3Tabs from "./Page3Tabs";
import AssignmentContent from "./AssignmentContent";
import TheoryContent from "./TheoryContent";
import SelfStudyContent from "./SelfStudyContent";
import { normalizeAssignmentData } from "./contentData";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export default function Page3() {
  const [activeTab, setActiveTab] = useState("theory");
  const [selectedLabId, setSelectedLabId] = useState(null);
  const [selectedModuleTitle, setSelectedModuleTitle] = useState("");
  const [selectedLabTitle, setSelectedLabTitle] = useState("");
  const [labs, setLabs] = useState([]);
  const [assignmentData, setAssignmentData] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState(null);
  const [assignmentStepIdx, setAssignmentStepIdx] = useState(0);
  const [assignmentAnswers, setAssignmentAnswers] = useState({});
  const assignmentCacheRef = useRef({});

  const fetchAssignmentData = useCallback(async (labId, { force = false } = {}) => {
    if (!labId) {
      setAssignmentData(null);
      setAssignmentError(null);
      setAssignmentLoading(false);
      return;
    }

    if (!force && assignmentCacheRef.current[labId]) {
      setAssignmentData(assignmentCacheRef.current[labId]);
      setAssignmentError(null);
      return;
    }

    setAssignmentLoading(true);
    setAssignmentError(null);
    setAssignmentData(null);

    try {
      const response = await fetch(`${API_BASE}/laboratory-works/${labId}/with_data/`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Не удалось загрузить данные");
      }

      const result = normalizeAssignmentData(await response.json());
      if (!result.success) {
        throw new Error(result.message || "Ошибка API");
      }

      assignmentCacheRef.current[labId] = result;
      setAssignmentData(result);
    } catch (error) {
      setAssignmentError(error.message || "Ошибка при загрузке задания");
      setAssignmentData(null);
    } finally {
      setAssignmentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedLabId) return;
    setAssignmentStepIdx(0);
    setAssignmentAnswers({});
    fetchAssignmentData(selectedLabId);
  }, [selectedLabId, fetchAssignmentData]);

  const handleSelectLab = useCallback((labId) => {
    setSelectedLabId(labId);
    setActiveTab("theory");
    setAssignmentStepIdx(0);
    setAssignmentAnswers({});
  }, []);

  const handleRefreshAssignmentData = useCallback(() => {
    if (!selectedLabId) return;
    setAssignmentStepIdx(0);
    setAssignmentAnswers({});
    fetchAssignmentData(selectedLabId, { force: true });
  }, [selectedLabId, fetchAssignmentData]);

  const handleSelfStudyComplete = useCallback(() => {
    const currentIndex = labs.findIndex((lab) => lab.id === selectedLabId);
    const nextLab = currentIndex >= 0 ? labs[currentIndex + 1] : null;

    if (nextLab) {
      setSelectedLabId(nextLab.id);
      setActiveTab("theory");
      return;
    }

    setActiveTab("theory");
  }, [labs, selectedLabId]);

  let content;
  if (activeTab === "theory") {
    content = <TheoryContent labId={selectedLabId} onComplete={() => setActiveTab("task")} />;
  } else if (activeTab === "self") {
    content = <SelfStudyContent labId={selectedLabId} onComplete={handleSelfStudyComplete} />;
  } else {
    content = (
      <AssignmentContent
        labId={selectedLabId}
        initialData={assignmentData}
        loading={assignmentLoading}
        error={assignmentError}
        onRefresh={handleRefreshAssignmentData}
        stepIdx={assignmentStepIdx}
        answers={assignmentAnswers}
        onStepChange={setAssignmentStepIdx}
        onAnswersChange={setAssignmentAnswers}
        onComplete={() => setActiveTab("self")}
      />
    );
  }

  return (
    <div className="w-full gap-2 flex overflow-hidden items-stretch h-full">
      <LeftBar
        selectedLabId={selectedLabId}
        onSelectLab={handleSelectLab}
        onLabsChange={setLabs}
        onSelectTitles={({ moduleTitle, labTitle }) => {
          setSelectedModuleTitle(moduleTitle || "");
          setSelectedLabTitle(labTitle || "");
        }}
      />

      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        <div className="shrink-0 p-2">
          <h1 className="text-xl font-semibold">
            {selectedModuleTitle || "Модуль"}
            {selectedLabTitle ? ` - ${selectedLabTitle}` : ""}
          </h1>
        </div>

        <div className="bg-white m-0 p-0 rounded-t-md border border-gray-200">
          <Page3Tabs activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="flex-1 min-h-0">{content}</div>
      </div>
    </div>
  );
}
