import { useState, useEffect, type FormEvent } from "react";
import { FiX, FiAlertCircle, FiUser, FiHash } from "react-icons/fi";
import type { Child, ChildFormData, ChildFormErrors, GenderType } from "../types/children.types";

interface ChildFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  child?: Child | null; // Truyền vào khi edit
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; age: number; gender: GenderType }) => Promise<void>;
}

const INITIAL_FORM: ChildFormData = {
  name: "",
  age: "",
  gender: "",
};

function validateForm(data: ChildFormData): ChildFormErrors {
  const errors: ChildFormErrors = {};

  if (!data.name.trim()) {
    errors.name = "Tên bé không được để trống";
  } else if (data.name.trim().length < 2) {
    errors.name = "Tên phải có ít nhất 2 ký tự";
  } else if (data.name.trim().length > 50) {
    errors.name = "Tên không được vượt quá 50 ký tự";
  }

  if (data.age === "") {
    errors.age = "Tuổi không được để trống";
  } else {
    const ageNum = Number(data.age);
    if (isNaN(ageNum) || !Number.isInteger(ageNum)) {
      errors.age = "Tuổi phải là số nguyên";
    } else if (ageNum < 0) {
      errors.age = "Tuổi không thể nhỏ hơn 0";
    } else if (ageNum > 18) {
      errors.age = "Tuổi không thể lớn hơn 18";
    }
  }

  if (!data.gender) {
    errors.gender = "Vui lòng chọn giới tính";
  }

  return errors;
}

export function ChildFormModal({
  isOpen,
  mode,
  child,
  isSubmitting,
  onClose,
  onSubmit,
}: ChildFormModalProps) {
  const [form, setForm] = useState<ChildFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ChildFormErrors>({});
  const [apiError, setApiError] = useState("");

  // Populate form khi edit
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && child) {
        setForm({
          name: child.name,
          age: String(child.age),
          gender: child.gender,
        });
      } else {
        setForm(INITIAL_FORM);
      }
      setErrors({});
      setApiError("");
    }
  }, [isOpen, mode, child]);

  // Đóng modal khi nhấn Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleChange = (field: keyof ChildFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Xóa error của field khi user bắt đầu nhập
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setApiError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError("");

    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await onSubmit({
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender as GenderType,
      });
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : mode === "create"
          ? "Tạo hồ sơ bé thất bại. Vui lòng thử lại."
          : "Cập nhật hồ sơ bé thất bại. Vui lòng thử lại.";
      setApiError(message);
    }
  };

  const title = mode === "create" ? "Thêm hồ sơ bé mới" : `Chỉnh sửa: ${child?.name}`;
  const submitLabel = mode === "create" ? "Thêm bé" : "Lưu thay đổi";

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal-content child-form-modal">
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng modal"
          >
            <FiX />
          </button>
        </div>

        {/* API Error */}
        {apiError && (
          <div className="alert alert-error" style={{ margin: "0 1.5rem 0" }}>
            <FiAlertCircle className="alert-icon" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {/* Tên bé */}
            <div className="form-group">
              <label className="form-label" htmlFor="child-name">
                Tên bé <span className="required-star">*</span>
              </label>
              <div className="input-wrapper">
                <FiUser className="input-icon" />
                <input
                  id="child-name"
                  type="text"
                  className={`form-input ${errors.name ? "error" : ""}`}
                  placeholder="Nguyễn Văn An"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  disabled={isSubmitting}
                  maxLength={50}
                  autoFocus
                />
              </div>
              {errors.name && (
                <div className="form-error">
                  <FiAlertCircle /> {errors.name}
                </div>
              )}
            </div>

            {/* Tuổi */}
            <div className="form-group">
              <label className="form-label" htmlFor="child-age">
                Tuổi <span className="required-star">*</span>
              </label>
              <div className="input-wrapper">
                <FiHash className="input-icon" />
                <input
                  id="child-age"
                  type="number"
                  className={`form-input ${errors.age ? "error" : ""}`}
                  placeholder="Nhập tuổi (0 - 18)"
                  value={form.age}
                  onChange={(e) => handleChange("age", e.target.value)}
                  disabled={isSubmitting}
                  min={0}
                  max={18}
                />
              </div>
              {errors.age && (
                <div className="form-error">
                  <FiAlertCircle /> {errors.age}
                </div>
              )}
            </div>

            {/* Giới tính */}
            <div className="form-group">
              <label className="form-label">
                Giới tính <span className="required-star">*</span>
              </label>
              <div className={`gender-selector ${errors.gender ? "error" : ""}`}>
                {(
                  [
                    { value: "male", label: "Nam", emoji: "👦" },
                    { value: "female", label: "Nữ", emoji: "👧" },
                    { value: "other", label: "Khác", emoji: "🧒" },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`gender-option ${
                      form.gender === option.value ? "selected" : ""
                    }`}
                    htmlFor={`gender-${option.value}`}
                  >
                    <input
                      id={`gender-${option.value}`}
                      type="radio"
                      name="gender"
                      value={option.value}
                      checked={form.gender === option.value}
                      onChange={() => handleChange("gender", option.value)}
                      disabled={isSubmitting}
                      className="gender-radio"
                    />
                    <span className="gender-emoji">{option.emoji}</span>
                    <span className="gender-label">{option.label}</span>
                  </label>
                ))}
              </div>
              {errors.gender && (
                <div className="form-error">
                  <FiAlertCircle /> {errors.gender}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-actions">
            <button
              type="button"
              id="cancel-child-form"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              id="submit-child-form"
              className={`btn btn-primary ${mode === "edit" ? "btn-update" : ""}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
