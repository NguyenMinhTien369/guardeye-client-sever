import api from "./api";
import { CHILDREN_ENDPOINTS } from "../constants/api";
import type {
  CreateChildRequest,
  UpdateChildRequest,
  GetAllChildrenResponse,
  GetChildByIdResponse,
  CreateChildResponse,
  UpdateChildResponse,
  DeleteChildResponse,
} from "../types/children.types";

// -----------------------------------------------------------------------------
// CHILDREN SERVICE
// Tất cả 5 API gọi tới BE, dùng axios instance đã setup interceptors (Bearer token).
// -----------------------------------------------------------------------------

export const childrenService = {
  /**
   * GET /children
   * Lấy danh sách tất cả bé của phụ huynh đang đăng nhập.
   */
  async getAll(): Promise<GetAllChildrenResponse> {
    const response = await api.get<GetAllChildrenResponse>(
      CHILDREN_ENDPOINTS.BASE
    );
    return response.data;
  },

  /**
   * GET /children/:id
   * Lấy chi tiết 1 bé theo ID.
   */
  async getById(id: string): Promise<GetChildByIdResponse> {
    const response = await api.get<GetChildByIdResponse>(
      CHILDREN_ENDPOINTS.BY_ID(id)
    );
    return response.data;
  },

  /**
   * POST /children
   * Tạo hồ sơ bé mới. Body: { name, age, gender }
   */
  async create(data: CreateChildRequest): Promise<CreateChildResponse> {
    const response = await api.post<CreateChildResponse>(
      CHILDREN_ENDPOINTS.BASE,
      data
    );
    return response.data;
  },

  /**
   * PUT /children/:id
   * Cập nhật hồ sơ bé. Body: { name?, age?, gender? }
   */
  async update(
    id: string,
    data: UpdateChildRequest
  ): Promise<UpdateChildResponse> {
    const response = await api.put<UpdateChildResponse>(
      CHILDREN_ENDPOINTS.BY_ID(id),
      data
    );
    return response.data;
  },

  /**
   * DELETE /children/:id
   * Xóa hồ sơ bé.
   */
  async remove(id: string): Promise<DeleteChildResponse> {
    const response = await api.delete<DeleteChildResponse>(
      CHILDREN_ENDPOINTS.BY_ID(id)
    );
    return response.data;
  },

  /**
   * POST /children/:id/avatar
   */
  async uploadAvatar(id: string, file: File): Promise<UpdateChildResponse> {
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await api.post<UpdateChildResponse>(
      CHILDREN_ENDPOINTS.BY_ID(id) + "/avatar",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },
};
