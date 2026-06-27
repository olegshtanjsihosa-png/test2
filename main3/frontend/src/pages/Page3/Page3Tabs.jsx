import { GraduationCap, BookOpen, PenTool } from "lucide-react";

const tabs = [
  { id: "theory", label: "Теория", icon: BookOpen },
  { id: "task", label: "Обучающее задание", icon: GraduationCap },
  { id: "self", label: "Самостоятельное задание", icon: PenTool },
];

export default function Page3Tabs({ activeTab, onChange }) {
  return (
    <div className="w-2/3 bg-white rounded-t-md ">
      <ol className="flex w-full flex-row">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeTab;
          return (
            <li
              key={item.id}
              className={`
                flex-1 flex items-center justify-center gap-2 cursor-pointer 
                py-3 px-2 transition-all duration-200
                ${active
                  ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                  : "text-gray-500 hover:text-gray-700"
                }
              `}
              onClick={() => onChange(item.id)}
            >
              <Icon size={13} className={active ? "text-blue-600" : "text-gray-500"} />
              <span className="text-sm font-medium">{item.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
