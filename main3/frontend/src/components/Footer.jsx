import { useLocation } from "react-router-dom";

export default function Footer() {
  const location = useLocation();
  if (location.pathname === "/labs") {
    return null;
  }

  return (
    <footer className="h-[50px] border-t border-gray-200 bg-white px-4 py-4 flex-shrink-0">
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-[11px] text-gray-400">
          © 2024-2025 Порохов Данила
        </p>
      </div>
    </footer>
  );
}
