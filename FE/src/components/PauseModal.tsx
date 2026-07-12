import { useState, useEffect, useRef, type FormEvent } from "react";
import { FiPauseCircle, FiAlertCircle, FiX, FiClock, FiCalendar, FiChevronDown } from "react-icons/fi";
import { FaInfinity } from "react-icons/fa6";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { vi } from "date-fns/locale/vi";
import type { Device, PauseFormData } from "../types/devices.types";

registerLocale("vi", vi);

interface PauseModalProps {
  isOpen: boolean;
  device: Device | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (deviceId: string, pausedUntil?: string) => Promise<void>;
}

/* ── Custom Time Dropdown (24h) ─────────────────────────────── */
interface TimeDropdownProps {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  disabled?: boolean;
}

function TimeDropdown({ hour, minute, onHourChange, onMinuteChange, disabled }: TimeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll selected into view when opening
  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => {
      hourListRef.current?.querySelector(".time-cell.selected")?.scrollIntoView({ block: "center" });
      minuteListRef.current?.querySelector(".time-cell.selected")?.scrollIntoView({ block: "center" });
    }, 30);
  }, [isOpen, hour, minute]);

  const formattedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    <div className="time-dropdown-wrapper" ref={ref}>
      <button
        type="button"
        className={`time-dropdown-trigger ${disabled ? "disabled" : ""} ${isOpen ? "open" : ""}`}
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        disabled={disabled}
      >
        <FiClock className="td-icon" />
        <span className="td-value">{disabled ? "--:--" : formattedTime}</span>
        <FiChevronDown className={`td-chevron ${isOpen ? "rotated" : ""}`} />
      </button>

      {isOpen && !disabled && (
        <div className="time-dropdown-panel">
          <div className="time-dropdown-columns">
            {/* Hours */}
            <div className="time-col-section">
              <div className="time-col-header">Giờ</div>
              <div className="time-col-list" ref={hourListRef}>
                {Array.from({ length: 24 }, (_, i) => (
                  <button
                    key={`h-${i}`}
                    type="button"
                    className={`time-cell ${i === hour ? "selected" : ""}`}
                    onClick={() => { onHourChange(i); }}
                  >
                    {String(i).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            <div className="time-col-divider" />

            {/* Minutes */}
            <div className="time-col-section">
              <div className="time-col-header">Phút</div>
              <div className="time-col-list" ref={minuteListRef}>
                {Array.from({ length: 60 }, (_, i) => (
                  <button
                    key={`m-${i}`}
                    type="button"
                    className={`time-cell ${i === minute ? "selected" : ""}`}
                    onClick={() => { onMinuteChange(i); }}
                  >
                    {String(i).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button type="button" className="time-dropdown-done" onClick={() => setIsOpen(false)}>
            Xong
          </button>
        </div>
      )}
    </div>
  );
}

/* ── PauseModal ─────────────────────────────────────────────── */

export function PauseModal({ isOpen, device, isSubmitting, onClose, onConfirm }: PauseModalProps) {
  const [form, setForm] = useState<PauseFormData>({ pauseType: "indefinite", pausedUntil: "" });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [error, setError] = useState("");

  // Sync date + hour + minute → form.pausedUntil
  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    d.setHours(hour, minute, 0, 0);
    setForm((prev) => ({ ...prev, pausedUntil: d.toISOString() }));
  }, [selectedDate, hour, minute]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setForm({ pauseType: "indefinite", pausedUntil: "" });
      setSelectedDate(null);
      const now = new Date();
      setHour(now.getHours());
      setMinute(Math.ceil(now.getMinutes() / 5) * 5 % 60);
      setError("");
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handle = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !device) return null;

  /* ── Preset helpers ─── */
  const applyPreset = (d: Date) => {
    setSelectedDate(d);
    setHour(d.getHours());
    setMinute(d.getMinutes());
    setError("");
  };

  const handlePresetClick = (hours: number) => applyPreset(new Date(Date.now() + hours * 3600000));
  const handleEndOfDay = () => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    applyPreset(d);
  };

  /* ── Date change ─── */
  const handleDateChange = (date: Date | null) => {
    if (!date) {
      setSelectedDate(null);
      setForm((prev) => ({ ...prev, pausedUntil: "" }));
      return;
    }
    setSelectedDate(date);
    setError("");
  };

  /* ── Submit ─── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.pauseType === "until") {
      if (!form.pausedUntil || !selectedDate) {
        setError("Vui lòng chọn ngày và giờ kết thúc");
        return;
      }
      if (new Date(form.pausedUntil) <= new Date()) {
        setError("Thời gian kết thúc phải ở trong tương lai");
        return;
      }
    }

    try {
      const pausedUntil = form.pauseType === "until" ? new Date(form.pausedUntil).toISOString() : undefined;
      await onConfirm(device.id, pausedUntil);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạm dừng thất bại. Vui lòng thử lại.");
    }
  };

  /* ── Preview string ─── */
  const previewStr = selectedDate
    ? (() => {
        const d = new Date(selectedDate);
        d.setHours(hour, minute);
        return d.toLocaleString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      })()
    : null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-content pause-modal">
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            <FiPauseCircle style={{ marginRight: 8, color: "var(--warning)" }} />
            Tạm dừng giám sát
          </h3>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            <p className="pause-device-name">
              Thiết bị: <strong>{device.deviceName}</strong>
            </p>

            {error && (
              <div className="alert alert-error">
                <FiAlertCircle className="alert-icon" />
                <span>{error}</span>
              </div>
            )}

            {/* Pause Type */}
            <div className="form-group">
              <label className="form-label">Chế độ tạm dừng</label>
              <div className="pause-type-grid">
                <label className={`pause-type-option ${form.pauseType === "indefinite" ? "selected" : ""}`} htmlFor="pause-indefinite">
                  <input id="pause-indefinite" type="radio" name="pauseType" value="indefinite"
                    checked={form.pauseType === "indefinite"}
                    onChange={() => { setForm((p) => ({ ...p, pauseType: "indefinite", pausedUntil: "" })); setSelectedDate(null); }}
                    disabled={isSubmitting} className="gender-radio" />
                  <FaInfinity className="pause-type-icon" />
                  <span className="pause-type-label">Vô thời hạn</span>
                  <span className="pause-type-desc">Mở lại thủ công khi muốn tiếp tục</span>
                </label>
                <label className={`pause-type-option ${form.pauseType === "until" ? "selected" : ""}`} htmlFor="pause-until">
                  <input id="pause-until" type="radio" name="pauseType" value="until"
                    checked={form.pauseType === "until"}
                    onChange={() => setForm((p) => ({ ...p, pauseType: "until" }))}
                    disabled={isSubmitting} className="gender-radio" />
                  <FiClock className="pause-type-icon" />
                  <span className="pause-type-label">Đến thời điểm</span>
                  <span className="pause-type-desc">Agent tự động tiếp tục khi hết giờ</span>
                </label>
              </div>
            </div>

            {/* Time Section */}
            {form.pauseType === "until" && (
              <div className="form-group pause-time-section">
                <label className="form-label">
                  Chọn thời điểm kết thúc <span className="required-star">*</span>
                </label>

                {/* Quick Presets */}
                <div className="time-presets-grid">
                  <button type="button" className="time-preset-btn" onClick={() => handlePresetClick(1)} disabled={isSubmitting}>+1 Giờ</button>
                  <button type="button" className="time-preset-btn" onClick={() => handlePresetClick(2)} disabled={isSubmitting}>+2 Giờ</button>
                  <button type="button" className="time-preset-btn" onClick={() => handlePresetClick(4)} disabled={isSubmitting}>+4 Giờ</button>
                  <button type="button" className="time-preset-btn" onClick={handleEndOfDay} disabled={isSubmitting}>Cuối ngày</button>
                </div>

                <div className="custom-time-divider"><span>Hoặc tùy chỉnh</span></div>

                {/* Two input fields: Date + Time */}
                <div className="datetime-fields-row">
                  {/* Date Field */}
                  <div className="datetime-field">
                    <label className="datetime-field-label"><FiCalendar /> Ngày</label>
                    <div className="react-datepicker-wrapper-custom">
                      <DatePicker
                        selected={selectedDate}
                        onChange={handleDateChange}
                        dateFormat="dd/MM/yyyy"
                        minDate={new Date()}
                        locale="vi"
                        placeholderText="Chọn ngày..."
                        className="form-input date-picker-input"
                        disabled={isSubmitting}
                        isClearable
                      />
                    </div>
                  </div>

                  {/* Time Field */}
                  <div className="datetime-field">
                    <label className="datetime-field-label"><FiClock /> Giờ</label>
                    <TimeDropdown
                      hour={hour}
                      minute={minute}
                      onHourChange={setHour}
                      onMinuteChange={setMinute}
                      disabled={isSubmitting || !selectedDate}
                    />
                  </div>
                </div>

                {/* Preview */}
                {previewStr && (
                  <div className="datetime-preview">
                    <FiClock style={{ flexShrink: 0 }} />
                    <span>{previewStr}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-actions">
            <button type="button" id="cancel-pause-device" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>Hủy</button>
            <button type="submit" id="confirm-pause-device" className="btn btn-warning" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="btn-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              ) : (
                <>
                  <FiPauseCircle style={{ marginRight: 6 }} />
                  Xác nhận tạm dừng
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
