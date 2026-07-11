import { useState, useCallback } from "react";
import { childrenService } from "../services/children.service";
import type { Child, CreateChildRequest, UpdateChildRequest } from "../types/children.types";

// -----------------------------------------------------------------------------
// useChildren Hook
// Quản lý toàn bộ state và actions cho trang Children.
// -----------------------------------------------------------------------------

interface UseChildrenReturn {
  children: Child[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  // Actions
  loadChildren: () => Promise<void>;
  createChild: (data: CreateChildRequest) => Promise<void>;
  updateChild: (id: string, data: UpdateChildRequest) => Promise<void>;
  deleteChild: (id: string) => Promise<void>;
}

export function useChildren(): UseChildrenReturn {
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * API 2: GET /children — Load toàn bộ danh sách bé
   */
  const loadChildren = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await childrenService.getAll();
      // BE trả về data là array trực tiếp
      setChildren(response.data ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể tải danh sách bé";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * API 1: POST /children — Tạo bé mới
   * Sau khi tạo thành công, thêm vào đầu danh sách (optimistic-like)
   */
  const createChild = useCallback(async (data: CreateChildRequest) => {
    setIsSubmitting(true);
    try {
      const response = await childrenService.create(data);
      if (response.data) {
        setChildren((prev) => [response.data!, ...prev]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  /**
   * API 4: PUT /children/:id — Cập nhật bé
   * Sau khi cập nhật, thay thế trong danh sách
   */
  const updateChild = useCallback(
    async (id: string, data: UpdateChildRequest) => {
      setIsSubmitting(true);
      try {
        const response = await childrenService.update(id, data);
        if (response.data) {
          setChildren((prev) =>
            prev.map((child) => (child.id === id ? response.data! : child))
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  /**
   * API 5: DELETE /children/:id — Xóa bé
   * Sau khi xóa thành công, loại khỏi danh sách
   */
  const deleteChild = useCallback(async (id: string) => {
    setIsSubmitting(true);
    try {
      await childrenService.remove(id);
      setChildren((prev) => prev.filter((child) => child.id !== id));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    children,
    isLoading,
    isSubmitting,
    error,
    loadChildren,
    createChild,
    updateChild,
    deleteChild,
  };
}
