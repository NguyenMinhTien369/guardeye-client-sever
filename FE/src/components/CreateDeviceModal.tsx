import { useState, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { FiX, FiAlertCircle, FiMonitor, FiPlus, FiTag } from "react-icons/fi";
import type { Child } from "../types/children.types";
import type { CreateDeviceFormData, CreateDeviceFormErrors } from "../types/devices.types";

interface CreateDeviceModalProps {
  isOpen: boolean;
  children: Child[];           // Danh sách bé để chọn (fetch từ Children API)
  isLoadingChildren: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (childId: string, deviceName: string, monitoredUsers: string[]) => Promise<void>;
}

const INITIAL_FORM: CreateDeviceFormData = {
  childId: "",
  deviceName: "",
  monitoredUsers: [],
  userInput: "",
};

function validateForm(data: CreateDeviceFormData): CreateDeviceFormErrors {
  const errors: CreateDeviceFormErrors = {};

  if (!data.childId) {
    errors.childId = "Vui lòng chọn một trẻ";
  }

  if (!data.deviceName.trim()) {
    errors.deviceName = "Tên thiết bị không được để trống";
  } else if (data.deviceName.trim().length < 2) {
    errors.deviceName = "Tên thiết bị phải có ít nhất 2 ký tự";
  } else if (data.deviceName.trim().length > 100) {
    errors.deviceName = "Tên thiết bị không được vượt quá 100 ký tự";
  }

  return errors;
}

export function CreateDeviceModal({
  isOpen,
  children,
  isLoadingChildren,
  isSubmitting,
  onClose,
  onSubmit,
}: CreateDeviceModalProps) {
  const [form, setForm] = useState<CreateDeviceFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<CreateDeviceFormErrors>({});
  const [apiError, setApiError] = useState("");

  // Reset form khi mở lại
  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL_FORM);
      setErrors({});
      setApiError("");
    }
  }, [isOpen]);

  // Đóng bằng Escape
  useEffect(() => {
    const handle = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleChange = (field: keyof CreateDeviceFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setApiError("");
  };

  // ── Tag Input Logic ────────────────────────────────────────────────────────
  const addUser = () => {
    const trimmed = form.userInput.trim();
    if (!trimmed) return;
    if (form.monitoredUsers.includes(trimmed)) {
      setApiError(`Username "${trimmed}" đã được thêm`);
      return;
    }
    setForm((prev) => ({
      ...prev,
      monitoredUsers: [...prev.monitoredUsers, trimmed],
      userInput: "",
    }));
    setErrors((prev) => ({ ...prev, monitoredUsers: undefined }));
    setApiError("");
  };

  const removeUser = (username: string) => {
    setForm((prev) => ({
      ...prev,
      monitoredUsers: prev.monitoredUsers.filter((u) => u !== username),
    }));
  };

  const handleUserInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addUser();
    }
    // Xóa tag cuối khi Backspace và input rỗng
    if (e.key === "Backspace" && form.userInput === "" && form.monitoredUsers.length > 0) {
      setForm((prev) => ({
        ...prev,
        monitoredUsers: prev.monitoredUsers.slice(0, -1),
      }));
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError("");

    // Thêm userInput đang còn trong ô trước khi submit
    const finalUsers = form.userInput.trim()
      ? [...new Set([...form.monitoredUsers, form.userInput.trim()])]
      : form.monitoredUsers;

    const formToValidate = { ...form, monitoredUsers: finalUsers };
    const validationErrors = validateForm(formToValidate);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await onSubmit(form.childId, form.deviceName.trim(), finalUsers);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tạo thiết bị thất bại. Vui lòng thử lại.";
      setApiError(msg);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Thêm thiết bị mới"
    >
      <div className="modal-content create-device-modal">
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            <FiMonitor style={{ marginRight: 8 }} />
            Thêm thiết bị mới
          </h3>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting} aria-label="Đóng">
            <FiX />
          </button>
        </div>

        {/* API Error */}
        {apiError && (
          <div className="alert alert-error" style={{ margin: "0 1.5rem" }}>
            <FiAlertCircle className="alert-icon" />
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {/* Chọn trẻ */}
            <div className="form-group">
              <label className="form-label" htmlFor="device-child">
                Thuộc về trẻ <span className="required-star">*</span>
              </label>
              <select
                id="device-child"
                className={`form-input form-select ${errors.childId ? "error" : ""}`}
                value={form.childId}
                onChange={(e) => handleChange("childId", e.target.value)}
                disabled={isSubmitting || isLoadingChildren}
              >
                <option value="">
                  {isLoadingChildren ? "Đang tải danh sách..." : "— Chọn trẻ —"}
                </option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name} ({child.age} tuổi · {child.gender === "male" ? "Nam" : child.gender === "female" ? "Nữ" : "Khác"})
                  </option>
                ))}
              </select>
              {errors.childId && (
                <div className="form-error"><FiAlertCircle /> {errors.childId}</div>
              )}
            </div>

            {/* Tên thiết bị */}
            <div className="form-group">
              <label className="form-label" htmlFor="device-name">
                Tên thiết bị <span className="required-star">*</span>
              </label>
              <div className="input-wrapper">
                <FiMonitor className="input-icon" />
                <input
                  id="device-name"
                  type="text"
                  className={`form-input ${errors.deviceName ? "error" : ""}`}
                  placeholder="VD: Laptop của Minh, PC phòng khách"
                  value={form.deviceName}
                  onChange={(e) => handleChange("deviceName", e.target.value)}
                  disabled={isSubmitting}
                  maxLength={100}
                  autoFocus
                />
              </div>
              {errors.deviceName && (
                <div className="form-error"><FiAlertCircle /> {errors.deviceName}</div>
              )}
            </div>

            {/* Windows Users — Tag Input */}
            <div className="form-group">
              <label className="form-label">
                <FiTag style={{ marginRight: 4 }} />
                Windows Username cần giám sát
                <span className="form-label-hint"> (nhấn Enter hoặc dấu phẩy để thêm)</span>
              </label>
              <div className={`tag-input-wrapper ${errors.monitoredUsers ? "error" : ""}`}>
                {/* Tags hiển thị */}
                {form.monitoredUsers.map((user) => (
                  <span key={user} className="user-tag user-tag--input">
                    {user}
                    <button
                      type="button"
                      className="tag-remove-btn"
                      onClick={() => removeUser(user)}
                      disabled={isSubmitting}
                      aria-label={`Xóa ${user}`}
                    >
                      <FiX />
                    </button>
                  </span>
                ))}
                {/* Input */}
                <input
                  id="device-users-input"
                  type="text"
                  className="tag-input"
                  placeholder={form.monitoredUsers.length === 0 ? "VD: MinhCup, Guest" : "Thêm user..."}
                  value={form.userInput}
                  onChange={(e) => handleChange("userInput", e.target.value)}
                  onKeyDown={handleUserInputKeyDown}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="tag-add-btn"
                  onClick={addUser}
                  disabled={!form.userInput.trim() || isSubmitting}
                  title="Thêm username"
                >
                  <FiPlus />
                </button>
              </div>
              {errors.monitoredUsers && (
                <div className="form-error"><FiAlertCircle /> {errors.monitoredUsers}</div>
              )}
              <p className="form-hint">
                Nhập Windows username trên máy cần theo dõi. Bỏ trống nếu giám sát tất cả users.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-actions">
            <button type="button" id="cancel-create-device" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </button>
            <button type="submit" id="submit-create-device" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="btn-spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
              ) : (
                <>
                  <FiMonitor style={{ marginRight: 6 }} />
                  Tạo thiết bị
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
