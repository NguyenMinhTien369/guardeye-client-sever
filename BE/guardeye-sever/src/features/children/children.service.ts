import childrenRepository from "./children.repository";
import { CreateChildDto, UpdateChildDto, ChildResponseDto } from "./children.dto";
import { NotFoundError } from "../../shared/core/error.response";
import { IChild } from "./children.model";

// -----------------------------------------------------------------------------
// CHILDREN SERVICE
// Chứa business logic cho quản lý hồ sơ con.
// -----------------------------------------------------------------------------

export class ChildrenService {
  /**
   * Chuyển đổi từ Mongoose document sang DTO sạch.
   */
  private toResponseDto(child: IChild): ChildResponseDto {
    return {
      id: child._id.toString(),
      parentId: child.parentId.toString(),
      name: child.name,
      age: child.age,
      avatar: child.avatar,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
    };
  }

  /**
   * Tạo hồ sơ con mới.
   */
  async createChild(parentId: string, data: CreateChildDto): Promise<ChildResponseDto> {
    const child = await childrenRepository.createChild(parentId, data);
    return this.toResponseDto(child);
  }

  /**
   * Lấy danh sách hồ sơ con của phụ huynh hiện tại.
   */
  async getChildrenByParent(parentId: string): Promise<ChildResponseDto[]> {
    const children = await childrenRepository.findByParentId(parentId);
    return children.map((child) => this.toResponseDto(child));
  }

  /**
   * Lấy chi tiết hồ sơ con.
   */
  async getChildById(parentId: string, childId: string): Promise<ChildResponseDto> {
    const child = await childrenRepository.findOneByParentAndId(parentId, childId);
    if (!child) {
      throw new NotFoundError("Không tìm thấy hồ sơ của bé");
    }
    return this.toResponseDto(child);
  }

  /**
   * Cập nhật hồ sơ con.
   */
  async updateChild(
    parentId: string,
    childId: string,
    data: UpdateChildDto
  ): Promise<ChildResponseDto> {
    const child = await childrenRepository.updateChild(parentId, childId, data);
    if (!child) {
      throw new NotFoundError("Không tìm thấy hồ sơ của bé để cập nhật");
    }
    return this.toResponseDto(child);
  }

  /**
   * Xóa hồ sơ con.
   */
  async deleteChild(parentId: string, childId: string): Promise<void> {
    const child = await childrenRepository.deleteChild(parentId, childId);
    if (!child) {
      throw new NotFoundError("Không tìm thấy hồ sơ của bé để xóa");
    }
  }
}

export default new ChildrenService();
