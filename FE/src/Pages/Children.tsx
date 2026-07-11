import { useEffect, useState } from "react";
import { FiPlus, FiUsers, FiAlertCircle, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";
import axios from "axios";
import { useChildren } from "../hooks/useChildren";
import { ChildCard } from "../components/ChildCard";
import { ChildFormModal } from "../components/ChildFormModal";
import type { Child, CreateChildRequest, GenderType } from "../types/children.types";

// ─── Delete Confirm Modal (inline, nhẹ hơn tách file) ─────────────────────
interface DeleteModalProps {
  child: Child;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ child, isDeleting, onConfirm, onCancel }: DeleteModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content delete-modal">
        <div className="delete-modal-icon">
          <FiTrash2 />
        </div>
        <h3 className="modal-title">Xác nhận xóa hồ sơ</h3>
        <p className="modal-text">
          Bạn có chắc chắn muốn xóa hồ sơ của{" "}
          <strong className="child-name-highlight">{child.name}</strong>?
          <br />
          <span className="delete-warning">Hành động này không thể hoàn tác.</span>
        </p>
        <div className="modal-actions">
          <button
            id="cancel-delete-child"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Hủy
          </button>
          <button
            id="confirm-delete-child"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <span className="btn-spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
            ) : (
              <>
                <FiTrash2 style={{ marginRight: "6px" }} />
                Xóa hồ sơ
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="children-empty-state">
      <div className="empty-icon-wrapper">
        <FiUsers className="empty-icon" />
      </div>
      <h3>Chưa có hồ sơ nào</h3>
      <p>Bắt đầu bằng cách thêm hồ sơ cho con bạn để quản lý và theo dõi hoạt động.</p>
      <button id="empty-add-child-btn" className="btn btn-primary" onClick={onAdd}>
        <FiPlus style={{ marginRight: "8px" }} />
        Thêm hồ sơ đầu tiên
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export function Children() {
  const {
    children,
    isLoading,
    isSubmitting,
    error,
    loadChildren,
    createChild,
    updateChild,
    deleteChild,
  } = useChildren();

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [childToDelete, setChildToDelete] = useState<Child | null>(null);

  // Load danh sách khi mount — API 2: GET /children
  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setFormMode("create");
    setSelectedChild(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (child: Child) => {
    setFormMode("edit");
    setSelectedChild(child);
    setFormModalOpen(true);
  };

  const handleOpenDelete = (child: Child) => {
    setChildToDelete(child);
    setDeleteModalOpen(true);
  };

  // API 1: POST /children
  const handleCreate = async (data: CreateChildRequest) => {
    await createChild(data);
    toast.success(`Đã thêm hồ sơ bé ${data.name} thành công!`);
  };

  // API 4: PUT /children/:id
  const handleUpdate = async (data: { name: string; age: number; gender: GenderType }) => {
    if (!selectedChild) return;
    try {
      await updateChild(selectedChild.id, data);
      toast.success(`Đã cập nhật hồ sơ bé ${data.name} thành công!`);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Cập nhật thất bại"
        : "Cập nhật thất bại";
      throw new Error(msg);
    }
  };

  // API 5: DELETE /children/:id
  const handleConfirmDelete = async () => {
    if (!childToDelete) return;
    try {
      await deleteChild(childToDelete.id);
      toast.success(`Đã xóa hồ sơ bé ${childToDelete.name}`);
      setDeleteModalOpen(false);
      setChildToDelete(null);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Xóa thất bại"
        : "Xóa thất bại";
      toast.error(msg);
      setDeleteModalOpen(false);
    }
  };

  const handleFormSubmit = async (data: { name: string; age: number; gender: GenderType }) => {
    if (formMode === "create") {
      await handleCreate(data);
    } else {
      await handleUpdate(data);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="children-page">
      {/* Page Header */}
      <div className="children-page-header">
        <div className="children-page-title-group">
          <h1 className="children-page-title">
            <FiUsers className="page-title-icon" />
            Quản lý hồ sơ trẻ
          </h1>
          <p className="children-page-subtitle">
            {children.length > 0
              ? `Đang theo dõi ${children.length} hồ sơ`
              : "Thêm hồ sơ để bắt đầu theo dõi"}
          </p>
        </div>

        <div className="children-header-actions">
          <button
            id="refresh-children-btn"
            className="btn btn-ghost icon-btn"
            onClick={loadChildren}
            disabled={isLoading}
            title="Làm mới danh sách"
            aria-label="Làm mới"
          >
            <FiRefreshCw className={isLoading ? "spin" : ""} />
          </button>
          <button
            id="add-child-btn"
            className="btn btn-primary"
            onClick={handleOpenCreate}
          >
            <FiPlus style={{ marginRight: "6px" }} />
            Thêm hồ sơ
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          <FiAlertCircle className="alert-icon" />
          <span>{error}</span>
          <button
            className="btn btn-ghost"
            style={{ marginLeft: "auto", padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}
            onClick={loadChildren}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && children.length === 0 ? (
        <div className="children-loading-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="child-card-skeleton" />
          ))}
        </div>
      ) : children.length === 0 && !error ? (
        /* Empty State */
        <EmptyState onAdd={handleOpenCreate} />
      ) : (
        /* Children Grid */
        <div className="children-grid">
          {children.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal — API 1 & 4 */}
      <ChildFormModal
        isOpen={formModalOpen}
        mode={formMode}
        child={selectedChild}
        isSubmitting={isSubmitting}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirm Modal — API 5 */}
      {deleteModalOpen && childToDelete && (
        <DeleteConfirmModal
          child={childToDelete}
          isDeleting={isSubmitting}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setChildToDelete(null);
          }}
        />
      )}
    </div>
  );
}
