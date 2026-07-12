import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiMonitor, FiPlus, FiAlertCircle, FiRefreshCw, FiTrash2, FiPlayCircle,
} from "react-icons/fi";
import toast from "react-hot-toast";
import axios from "axios";
import { useDevices } from "../hooks/useDevices";
import { DeviceCard } from "../components/DeviceCard";
import { CreateDeviceModal } from "../components/CreateDeviceModal";
import { DeviceTokenModal } from "../components/DeviceTokenModal";
import { PauseModal } from "../components/PauseModal";
import { childrenService } from "../services/children.service";
import type { Device, CreateDeviceResponseData, PauseDeviceRequest } from "../types/devices.types";
import type { Child } from "../types/children.types";

// ── Delete Confirm Modal (inline) ──────────────────────────────────────────
interface DeleteModalProps {
  device: Device;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ device, isDeleting, onConfirm, onCancel }: DeleteModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content delete-modal">
        <div className="delete-modal-icon">
          <FiTrash2 />
        </div>
        <h3 className="modal-title">Xác nhận xóa thiết bị</h3>
        <p className="modal-text">
          Bạn có chắc muốn xóa thiết bị{" "}
          <strong className="child-name-highlight">{device.deviceName}</strong>?
          <br />
          <span className="delete-warning">
            Agent trên máy đó sẽ mất kết nối. Hành động này không thể hoàn tác.
          </span>
        </p>
        <div className="modal-actions">
          <button id="cancel-delete-device" className="btn btn-ghost" onClick={onCancel} disabled={isDeleting}>
            Hủy
          </button>
          <button id="confirm-delete-device" className="btn btn-danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <span className="btn-spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
            ) : (
              <><FiTrash2 style={{ marginRight: 6 }} /> Xóa thiết bị</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Resume Confirm Modal (inline) ──────────────────────────────────────────
interface ResumeModalProps {
  device: Device;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ResumeConfirmModal({ device, isSubmitting, onConfirm, onCancel }: ResumeModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content delete-modal">
        <div className="delete-modal-icon" style={{ background: "#d1fae5", color: "#059669" }}>
          <FiPlayCircle />
        </div>
        <h3 className="modal-title">Tiếp tục giám sát?</h3>
        <p className="modal-text">
          Bạn muốn tiếp tục giám sát thiết bị{" "}
          <strong className="child-name-highlight">{device.deviceName}</strong>?
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={isSubmitting}>Hủy</button>
          <button
            id="confirm-resume-device"
            className="btn btn-success"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="btn-spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
            ) : (
              <><FiPlayCircle style={{ marginRight: 6 }} /> Tiếp tục</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="children-empty-state">
      <div className="empty-icon-wrapper">
        <FiMonitor className="empty-icon" />
      </div>
      <h3>Chưa có thiết bị nào</h3>
      <p>Thêm thiết bị để bắt đầu theo dõi hoạt động của trẻ trên máy tính.</p>
      <button id="empty-add-device-btn" className="btn btn-primary" onClick={onAdd}>
        <FiPlus style={{ marginRight: 8 }} />
        Thêm thiết bị đầu tiên
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export function Devices() {
  const navigate = useNavigate();
  const {
    devices, isLoading, isSubmitting, error,
    loadDevices, createDevice, pauseDevice, resumeDevice, deleteDevice,
  } = useDevices();

  // Children list (để chọn khi tạo thiết bị)
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);

  // Build childId → childName lookup map
  const childMap = children.reduce<Record<string, string>>((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {});

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenData, setTokenData] = useState<CreateDeviceResponseData | null>(null);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [activeTab, setActiveTab] = useState<'disconnected' | 'connected'>('connected');

  // Load devices khi mount — API 2: GET /devices
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Load children list cho dropdown
  const loadChildren = async () => {
    setIsLoadingChildren(true);
    try {
      const response = await childrenService.getAll();
      setChildren(response.data ?? []);
    } catch {
      // Không throw — chỉ là không có list để chọn
    } finally {
      setIsLoadingChildren(false);
    }
  };

  const handleOpenCreate = () => {
    loadChildren();
    setCreateModalOpen(true);
  };

  // API 1: POST /children/:childId/devices
  const handleCreate = async (childId: string, deviceName: string, monitoredUsers: string[]) => {
    try {
      const data = await createDevice(childId, { deviceName, monitoredUsers });
      setCreateModalOpen(false);
      // Hiển thị token modal ngay lập tức
      setTokenData(data);
      setTokenModalOpen(true);
      toast.success(`Thiết bị "${deviceName}" đã được tạo thành công!`);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Tạo thiết bị thất bại"
        : "Tạo thiết bị thất bại";
      throw new Error(msg);
    }
  };

  // API 3: PATCH /devices/:id/pause
  const handlePauseConfirm = async (deviceId: string, pausedUntil?: string) => {
    try {
      const data: PauseDeviceRequest = pausedUntil ? { pausedUntil } : {};
      await pauseDevice(deviceId, data);
      toast.success("Đã tạm dừng giám sát thiết bị");
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Tạm dừng thất bại"
        : "Tạm dừng thất bại";
      throw new Error(msg);
    }
  };

  // API 4: PATCH /devices/:id/resume
  const handleResumeConfirm = async () => {
    if (!selectedDevice) return;
    try {
      await resumeDevice(selectedDevice.id);
      toast.success(`Đã tiếp tục giám sát thiết bị "${selectedDevice.deviceName}"`);
      setResumeModalOpen(false);
      setSelectedDevice(null);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Tiếp tục thất bại"
        : "Tiếp tục thất bại";
      toast.error(msg);
      setResumeModalOpen(false);
    }
  };

  // API 5: DELETE /devices/:id
  const handleDeleteConfirm = async () => {
    if (!selectedDevice) return;
    try {
      await deleteDevice(selectedDevice.id);
      toast.success(`Đã xóa thiết bị "${selectedDevice.deviceName}"`);
      setDeleteModalOpen(false);
      setSelectedDevice(null);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Xóa thất bại"
        : "Xóa thất bại";
      toast.error(msg);
      setDeleteModalOpen(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const disconnectedDevices = devices.filter(d => d.status !== 'active');
  const connectedDevices = devices.filter(d => d.status === 'active');
  const currentDevices = activeTab === 'disconnected' ? disconnectedDevices : connectedDevices;

  return (
    <div className="devices-page">
      {/* Header */}
      <div className="children-page-header">
        <div className="children-page-title-group">
          <h1 className="children-page-title">
            <FiMonitor className="page-title-icon" />
            Quản lý thiết bị
          </h1>
          <p className="children-page-subtitle">
            {devices.length > 0
              ? `Đang quản lý ${devices.length} thiết bị giám sát`
              : "Thêm thiết bị để bắt đầu giám sát"}
          </p>
        </div>
        <div className="children-header-actions">
          <button
            id="refresh-devices-btn"
            className="btn btn-ghost icon-btn"
            onClick={loadDevices}
            disabled={isLoading}
            title="Làm mới"
          >
            <FiRefreshCw className={isLoading ? "spin" : ""} />
          </button>
          <button id="add-device-btn" className="btn btn-primary" onClick={handleOpenCreate}>
            <FiPlus style={{ marginRight: 6 }} />
            Thêm thiết bị
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          <FiAlertCircle className="alert-icon" />
          <span>{error}</span>
          <button className="btn btn-ghost" style={{ marginLeft: "auto", padding: "0.25rem 0.75rem", fontSize: "0.8rem" }} onClick={loadDevices}>
            Thử lại
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="dm-tabs" style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
        <button
          className={`dm-tab ${activeTab === 'connected' ? 'active' : ''}`}
          onClick={() => setActiveTab('connected')}
        >
          Đang hoạt động
          {connectedDevices.length > 0 && <span className="dm-tab-badge">{connectedDevices.length}</span>}
        </button>
        <button
          className={`dm-tab ${activeTab === 'disconnected' ? 'active' : ''}`}
          onClick={() => setActiveTab('disconnected')}
        >
          Thiết bị chưa kết nối
          {disconnectedDevices.length > 0 && <span className="dm-tab-badge">{disconnectedDevices.length}</span>}
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && devices.length === 0 ? (
        <div className="children-loading-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="device-card-skeleton" />
          ))}
        </div>
      ) : devices.length === 0 && !error ? (
        <EmptyState onAdd={handleOpenCreate} />
      ) : (
        <div className="devices-grid">
          {currentDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              childName={childMap[device.childId]}
              onPause={(d) => { setSelectedDevice(d); setPauseModalOpen(true); }}
              onResume={(d) => { setSelectedDevice(d); setResumeModalOpen(true); }}
              onDelete={(d) => { setSelectedDevice(d); setDeleteModalOpen(true); }}
              onViewMonitor={(d) => navigate(`/devices/${d.id}/monitor`)}
            />
          ))}
          {currentDevices.length === 0 && (
            <div className="split-empty-text" style={{ gridColumn: '1 / -1' }}>
              Không có thiết bị nào trong danh mục này
            </div>
          )}
        </div>
      )}

      {/* Create Modal — API 1 */}
      <CreateDeviceModal
        isOpen={createModalOpen}
        children={children}
        isLoadingChildren={isLoadingChildren}
        isSubmitting={isSubmitting}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Token Modal — hiển thị ngay sau khi tạo */}
      <DeviceTokenModal
        isOpen={tokenModalOpen}
        data={tokenData}
        onClose={() => { setTokenModalOpen(false); setTokenData(null); }}
      />

      {/* Pause Modal — API 3 */}
      <PauseModal
        isOpen={pauseModalOpen}
        device={selectedDevice}
        isSubmitting={isSubmitting}
        onClose={() => { setPauseModalOpen(false); setSelectedDevice(null); }}
        onConfirm={handlePauseConfirm}
      />

      {/* Resume Confirm Modal — API 4 */}
      {resumeModalOpen && selectedDevice && (
        <ResumeConfirmModal
          device={selectedDevice}
          isSubmitting={isSubmitting}
          onConfirm={handleResumeConfirm}
          onCancel={() => { setResumeModalOpen(false); setSelectedDevice(null); }}
        />
      )}

      {/* Delete Confirm Modal — API 5 */}
      {deleteModalOpen && selectedDevice && (
        <DeleteConfirmModal
          device={selectedDevice}
          isDeleting={isSubmitting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setDeleteModalOpen(false); setSelectedDevice(null); }}
        />
      )}
    </div>
  );
}
