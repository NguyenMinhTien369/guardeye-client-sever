import Child, { IChild } from "./children.model";
import { CreateChildDto, UpdateChildDto } from "./children.dto";

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
  async createChild(parentId: string, data: CreateChildDto): Promise<IChild> {
    const child = new Child({
      parentId,
      ...data,
    });
    return child.save();
  }

  /**
   * Cập nhật thông tin hồ sơ con.
   */
  async updateChild(
    parentId: string,
    childId: string,
    data: UpdateChildDto
  ): Promise<IChild | null> {
    return Child.findOneAndUpdate(
      { _id: childId, parentId },
      { $set: data },
      { new: true }
    );
  }

  /**
   * Xóa hồ sơ con.
   */
  async deleteChild(parentId: string, childId: string): Promise<IChild | null> {
    return Child.findOneAndDelete({ _id: childId, parentId });
  }

  // ---------------------------------------------------------------------------
  // READ OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Tìm tất cả hồ sơ con thuộc về một phụ huynh.
   */
  async findByParentId(parentId: string): Promise<IChild[]> {
    return Child.find({ parentId });
  }

  /**
   * Tìm hồ sơ con theo ID và Parent ID để bảo mật thông tin.
   */
  async findOneByParentAndId(parentId: string, childId: string): Promise<IChild | null> {
    return Child.findOne({ _id: childId, parentId });
  }

  /**
   * Tìm theo ID chung.
   */
  async findById(childId: string): Promise<IChild | null> {
    return Child.findById(childId);
  }
}

export default new ChildrenRepository();
