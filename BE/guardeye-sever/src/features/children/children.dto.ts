// -----------------------------------------------------------------------------
// CHILDREN DTO - Định nghĩa cấu trúc dữ liệu cho hồ sơ bé
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 1. REQUEST DTOs
// -----------------------------------------------------------------------------

export interface CreateChildDto {
  name: string;
  age: number;
  avatar?: string;
}

export interface UpdateChildDto {
  name?: string;
  age?: number;
  avatar?: string;
}

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs
// -----------------------------------------------------------------------------

export interface ChildResponseDto {
  id: string;
  parentId: string;
  name: string;
  age: number;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
}
