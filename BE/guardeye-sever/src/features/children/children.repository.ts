import Child, { IChild } from "./children.model";
import { CreateChildRequestDto, UpdateChildRequestDto } from "./children.dto";

// -----------------------------------------------------------------------------
// CHILDREN REPOSITORY
// Chịu trách nhiệm tương tác với database qua Mongoose Model cho thực thể Child.
// -----------------------------------------------------------------------------

export class ChildrenRepository {
  // ---------------------------------------------------------------------------
  // WRITE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Tạo hồ sơ con mới liên kết với Parent ID.
   */
  async create(data: { parentId: string } & CreateChildRequestDto): Promise<IChild> {
    const child = new Child(data);
    return child.save();
  }

  /**
   * Cập nhật thông tin hồ sơ con theo ID và Parent ID.
   */
  async updateByIdAndParent(
    childId: string,
    parentId: string,
    data: UpdateChildRequestDto
  ): Promise<IChild | null> {
    return Child.findOneAndUpdate(
      { _id: childId, parentId },
      { $set: data },
      { new: true }
    );
  }

  /**
   * Xóa hồ sơ con theo ID và Parent ID.
   */
  async deleteByIdAndParent(childId: string, parentId: string): Promise<IChild | null> {
    return Child.findOneAndDelete({ _id: childId, parentId });
  }

  // ---------------------------------------------------------------------------
  // READ OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Tìm tất cả hồ sơ con thuộc về một phụ huynh.
   */
  async findAllByParent(parentId: string): Promise<IChild[]> {
    return Child.find({ parentId });
  }

  /**
   * Tìm hồ sơ con theo ID và Parent ID — đảm bảo phụ huynh chỉ thấy con mình.
   */
  async findByIdAndParent(childId: string, parentId: string): Promise<IChild | null> {
    return Child.findOne({ _id: childId, parentId });
  }
}

export default new ChildrenRepository();
