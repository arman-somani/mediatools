import mongoose, { Document, Schema } from 'mongoose';

export type FeedbackType = 'compliment' | 'complain' | 'bug';

export interface IFeedback extends Document {
  name: string;
  email: string;
  type: FeedbackType;
  message: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['compliment', 'complain', 'bug'],
      required: true,
    },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    userId: { type: String, index: true },
  },
  { timestamps: true }
);

export const Feedback = mongoose.model<IFeedback>('Feedback', feedbackSchema);
