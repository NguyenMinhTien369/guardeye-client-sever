// -----------------------------------------------------------------------------
// CHILDREN DTO - Định nghĩa cấu trúc dữ liệu cho hồ sơ bé
// -----------------------------------------------------------------------------

import { GenderType } from "./children.model";

// -----------------------------------------------------------------------------
// 1. REQUEST DTOs
// -----------------------------------------------------------------------------

// [CREATE] Tạo hồ sơ bé mới
export interface CreateChildRequestDto {
  name: string;
  age: number;
  gender: GenderType;
}

// [UPDATE] Cập nhật hồ sơ bé — tất cả trường là optional
export interface UpdateChildRequestDto {
  name?: string;
  age?: number;
  gender?: GenderType;
}

// [LIST] Query params khi lấy danh sách bé của parent
export interface GetChildrenQueryDto {
  page?: number;       // Trang hiện tại (default: 1)
  limit?: number;      // Số bé mỗi trang (default: 10)
  gender?: GenderType; // Lọc theo giới tính (optional)
  name?: string;       // Tìm kiếm theo tên (optional, partial match)
}

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs
// -----------------------------------------------------------------------------

// [SINGLE] Thông tin một bé trả về client
export interface ChildResponseDto {
  id: string;
  parentId: string;
  name: string;
  age: number;
  gender: GenderType;
  createdAt: Date;
  updatedAt: Date;
}

// [LIST] Danh sách bé kèm thông tin phân trang
export interface GetChildrenResponseDto {
  children: ChildResponseDto[];
  pagination: {
    total: number;      // Tổng số bé
    page: number;       // Trang hiện tại
    limit: number;      // Số bé mỗi trang
    totalPages: number; // Tổng số trang
  };
}

// [CREATE] Response sau khi tạo bé thành công
export interface CreateChildResponseDto {
  child: ChildResponseDto;
  message: string;
}

// [UPDATE] Response sau khi cập nhật bé thành công
export interface UpdateChildResponseDto {
  child: ChildResponseDto;
  message: string;
}

// [DELETE] Response sau khi xóa bé thành công
export interface DeleteChildResponseDto {
  message: string;
  deletedId: string;
}
