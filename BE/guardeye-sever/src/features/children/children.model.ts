import mongoose, { Document, Schema, Model } from "mongoose";

// Định nghĩa trước các giá trị cho giới tính
export enum GenderType {
  male = "male",
  female = "female",
  other = "other",
}

// -----------------------------------------------------------------------------
// 1. ĐỊNH NGHĨA INTERFACE (TYPESCRIPT)
// -----------------------------------------------------------------------------

export interface IChild extends Document {
  parentId: mongoose.Types.ObjectId;
  name: string;
  age: number;
  gender: GenderType;
  createdAt: Date;
  updatedAt: Date;
}

type ChildModel = Model<IChild>;

// -----------------------------------------------------------------------------
// 2. SCHEMA
// -----------------------------------------------------------------------------

const childSchema = new Schema<IChild, ChildModel>(
  {
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Parent ID là bắt buộc"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Tên của bé là bắt buộc"],
      trim: true,
      minlength: [2, "Tên phải có ít nhất 2 ký tự"],
      maxlength: [50, "Tên không được vượt quá 50 ký tự"],
    },
    age: {
      type: Number,
      required: [true, "Tuổi của bé là bắt buộc"],
      min: [0, "Tuổi không được nhỏ hơn 0"],
      max: [18, "Tuổi không được lớn hơn 18"],
    },
    gender: {
      type: String,
      enum: Object.values(GenderType),
      required: [true, "Giới tính của trẻ là bắt buộc"],
    },
  },
  {
    timestamps: true,
  }
);

// -----------------------------------------------------------------------------
// 3. DATA TRANSFORM
// -----------------------------------------------------------------------------

childSchema.set("toJSON", {
  transform: (doc, ret: Record<string, any>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// -----------------------------------------------------------------------------
// 4. EXPORT
// -----------------------------------------------------------------------------

const Child = mongoose.model<IChild, ChildModel>("Child", childSchema);

export default Child;
