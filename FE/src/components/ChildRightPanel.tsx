import { useState, useEffect } from "react";
import { FiX, FiSave, FiPieChart, FiTrash2 } from "react-icons/fi";
import type { Child, ChildFormData, GenderType } from "../types/children.types";
import { childrenService } from "../services/children.service";
import toast from "react-hot-toast";
import "./ChildRightPanel.css";

// Helper để lấy URL ảnh đầy đủ từ backend
export const getAvatarFullUrl = (avatarUrl?: string | null) => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http")) return avatarUrl;
  return `http://localhost:5000${avatarUrl}`;
};

interface ChildRightPanelProps {
  isOpen: boolean;
  child: Child | null;
  onClose: () => void;
  onUpdate: (updatedChild: Child) => void;
  onDeleteRequest: (child: Child) => void;
  onViewDashboard: (childId: string) => void;
}

export function ChildRightPanel({
  isOpen,
  child,
  onClose,
  onUpdate,
  onDeleteRequest,
  onViewDashboard,
}: ChildRightPanelProps) {
  const [formData, setFormData] = useState<ChildFormData>({
    name: "",
    age: "",
    gender: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync formData khi child thay đổi
  useEffect(() => {
    if (child) {
      setFormData({
        name: child.name,
        age: child.age.toString(),
        gender: child.gender,
      });
    }
  }, [child]);

  // Sync formData khi child thay đổi
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!child) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        age: Number(formData.age),
        gender: formData.gender as GenderType,
      };
      const res = await childrenService.update(child.id, payload);
      toast.success("Cập nhật thông tin thành công");
      if (res.data) onUpdate(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Cập nhật thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !child) return null;

  return (
    <>
      <div className={`child-right-panel ${isOpen ? "open" : ""}`}>
        <div className="panel-header">
          <h2>Hồ sơ của bé</h2>
          <button className="btn-icon" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="panel-content">
          {/* Device Section */}
          <div className="avatar-section" style={{ paddingBottom: "1rem" }}>
            <div style={{
              width: "100px",
              height: "65px",
              background: "#1e293b", // Khung màn hình màu tối
              borderRadius: "6px",
              position: "relative",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "15px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              marginTop: "20px"
            }}>
              {/* Màn hình (phần sáng lên) */}
              <div style={{ 
                width: "90px", 
                height: "55px", 
                background: "var(--accent-primary, #3b82f6)", 
                borderRadius: "2px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
              }}>
                <span style={{color: "rgba(255,255,255,0.7)", fontSize: "24px"}}>G</span>
              </div>
              {/* Bàn phím / Đế laptop */}
              <div style={{
                position: "absolute",
                bottom: "-8px",
                left: "-15px",
                right: "-15px",
                height: "8px",
                background: "#94a3b8", // Màu bạc kim loại
                borderRadius: "1px 1px 6px 6px",
                borderBottom: "2px solid #64748b"
              }}></div>
            </div>
            
            <p style={{ marginTop: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>
              Thiết bị giám sát
            </p>
            <p className="child-date-panel" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Đã kết nối lúc: {new Date(child.createdAt).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Form Info */}
          <form className="child-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Họ và tên</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Tuổi</label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="100"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Giới tính</label>
              <select
                className="form-input"
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
              >
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : <><FiSave /> Lưu thay đổi</>}
            </button>
          </form>

          {/* Actions */}
          <div className="panel-actions-divider">
            <span>Hoặc</span>
          </div>
          
          <div className="panel-extra-actions">
            <button
              className="btn btn-outline"
              onClick={() => onViewDashboard(child.id)}
            >
              <FiPieChart /> Xem báo cáo
            </button>
            <button
              className="btn btn-danger-outline"
              onClick={() => onDeleteRequest(child)}
            >
              <FiTrash2 /> Xóa hồ sơ
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
