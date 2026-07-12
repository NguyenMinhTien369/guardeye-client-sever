import { FiEdit2, FiTrash2, FiUser, FiPieChart } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import type { Child } from "../types/children.types";

interface ChildCardProps {
  child: Child;
  onEdit: (child: Child) => void;
  onDelete: (child: Child) => void;
}

const GENDER_CONFIG = {
  male: { label: "Nam", emoji: "👦", className: "gender-badge gender-male" },
  female: { label: "Nữ", emoji: "👧", className: "gender-badge gender-female" },
  other: { label: "Khác", emoji: "🧒", className: "gender-badge gender-other" },
};

const AVATAR_COLORS: Record<string, string> = {
  A: "#6366f1", B: "#8b5cf6", C: "#ec4899", D: "#f43f5e",
  E: "#f97316", F: "#eab308", G: "#22c55e", H: "#14b8a6",
  I: "#0ea5e9", J: "#3b82f6", K: "#a855f7", L: "#e11d48",
  M: "#0891b2", N: "#059669", O: "#d97706", P: "#7c3aed",
  Q: "#be123c", R: "#1d4ed8", S: "#047857", T: "#b45309",
  U: "#6d28d9", V: "#0f766e", W: "#9333ea", X: "#c2410c",
  Y: "#15803d", Z: "#1e40af",
};

function getAvatarColor(name: string): string {
  const firstChar = name.charAt(0).toUpperCase();
  return AVATAR_COLORS[firstChar] || "#002855";
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ChildCard({ child, onEdit, onDelete }: ChildCardProps) {
  const navigate = useNavigate();
  const genderConfig = GENDER_CONFIG[child.gender];
  const avatarColor = getAvatarColor(child.name);
  const initials = child.name
    .split(" ")
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleCardClick = () => {
    onEdit(child); // In this new design, onEdit actually opens the Right Panel
  };

  const getAvatarFullUrl = (avatarUrl?: string | null) => {
    if (!avatarUrl) return null;
    if (avatarUrl.startsWith("http")) return avatarUrl;
    return `http://localhost:5000${avatarUrl}`;
  };

  const avatarUrl = getAvatarFullUrl(child.avatarUrl);

  return (
    <div className="child-card clickable" onClick={handleCardClick}>
      {/* Avatar */}
      <div
        className="child-avatar"
        style={{ backgroundColor: avatarUrl ? 'transparent' : avatarColor, overflow: 'hidden' }}
        aria-label={`Avatar của ${child.name}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials || <FiUser />
        )}
      </div>

      {/* Info */}
      <div className="child-info">
        <h3 className="child-name">{child.name}</h3>

        <div className="child-meta">
          <span className="child-age">
            <span className="age-number">{child.age}</span>
            <span className="age-label"> tuổi</span>
          </span>
          <span className={genderConfig.className}>
            {genderConfig.emoji} {genderConfig.label}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="child-actions">
        <button
          className="child-action-btn view-dashboard"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/children/${child.id}/dashboard`);
          }}
          aria-label={`Xem tổng quan ${child.name}`}
          title="Xem báo cáo"
        >
          <FiPieChart />
        </button>
        <button
          id={`delete-child-${child.id}`}
          className="child-action-btn delete-btn-custom"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(child);
          }}
          aria-label={`Xóa hồ sơ ${child.name}`}
          title="Xóa"
        >
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
}
