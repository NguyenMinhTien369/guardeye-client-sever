import childrenRepository from "./children.repository";
import { CreateChildRequestDto, UpdateChildRequestDto, ChildResponseDto } from "./children.dto";
import { NotFoundError } from "../../shared/core/error.response";
import { IChild } from "./children.model";

// -----------------------------------------------------------------------------
// CHILDREN SERVICE
// Chứa business logic cho quản lý hồ sơ con.
// -----------------------------------------------------------------------------

export class ChildrenService {
  /**
   * Chuyển đổi từ Mongoose document sang DTO sạch để trả về client.
   */
  private toResponseDto(child: IChild): ChildResponseDto {
    return {
      id: child._id.toString(),
      parentId: child.parentId.toString(),
      name: child.name,
      age: child.age,
      gender: child.gender,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
    };
  }

  /**
   * Tạo hồ sơ con mới cho phụ huynh.
   */
  async create(parentId: string, data: CreateChildRequestDto): Promise<ChildResponseDto> {
    const child = await childrenRepository.create({ parentId, ...data });
    return this.toResponseDto(child);
  }

  /**
   * Lấy danh sách hồ sơ con của phụ huynh hiện tại.
   */
  async getAll(parentId: string): Promise<ChildResponseDto[]> {
    const children = await childrenRepository.findAllByParent(parentId);
    return children.map((child) => this.toResponseDto(child));
  }

  /**
   * Lấy chi tiết hồ sơ con theo ID — chỉ trả về con của đúng phụ huynh.
   */
  async getById(childId: string, parentId: string): Promise<ChildResponseDto> {
    const child = await childrenRepository.findByIdAndParent(childId, parentId);
    if (!child) {
      throw new NotFoundError("Không tìm thấy hồ sơ của bé");
    }
    return this.toResponseDto(child);
  }

  /**
   * Cập nhật hồ sơ con — chỉ cho phép phụ huynh sở hữu chỉnh sửa.
   */
  async update(
    childId: string,
    parentId: string,
    data: UpdateChildRequestDto
  ): Promise<ChildResponseDto> {
    const child = await childrenRepository.updateByIdAndParent(childId, parentId, data);
    if (!child) {
      throw new NotFoundError("Không tìm thấy hồ sơ của bé để cập nhật");
    }
    return this.toResponseDto(child);
  }

  /**
   * Xóa hồ sơ con — chỉ cho phép phụ huynh sở hữu thực hiện.
   */
  async remove(childId: string, parentId: string): Promise<void> {
    const child = await childrenRepository.deleteByIdAndParent(childId, parentId);
    if (!child) {
      throw new NotFoundError("Không tìm thấy hồ sơ của bé để xóa");
    }
  }
}

export default new ChildrenService();
