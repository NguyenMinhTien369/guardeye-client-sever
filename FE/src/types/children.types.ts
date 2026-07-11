// ===== Enums =====
export type GenderType = "male" | "female" | "other";

// ===== Child Entity =====
export interface Child {
  id: string;
  parentId: string;
  name: string;
  age: number;
  gender: GenderType;
  createdAt: string;
  updatedAt: string;
}

// ===== Request DTOs =====
export interface CreateChildRequest {
  name: string;
  age: number;
  gender: GenderType;
}

export interface UpdateChildRequest {
  name?: string;
  age?: number;
  gender?: GenderType;
}

// ===== Response DTOs =====
export interface ChildrenApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

// GET /children — BE trả về array thẳng
export type GetAllChildrenResponse = ChildrenApiResponse<Child[]>;

// GET /children/:id — trả về single child
export type GetChildByIdResponse = ChildrenApiResponse<Child>;

// POST /children — trả về child vừa tạo
export type CreateChildResponse = ChildrenApiResponse<Child>;

// PUT /children/:id — trả về child đã update
export type UpdateChildResponse = ChildrenApiResponse<Child>;

// DELETE /children/:id — trả về message + deletedId (hoặc chỉ message)
export type DeleteChildResponse = ChildrenApiResponse<{ deletedId?: string }>;

// ===== Form State =====
export interface ChildFormData {
  name: string;
  age: string; // string vì input luôn là string, convert khi submit
  gender: GenderType | "";
}

export interface ChildFormErrors {
  name?: string;
  age?: string;
  gender?: string;
}
