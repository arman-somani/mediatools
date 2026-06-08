import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  userId: string;
  orderId: string;
  paymentId—: string;
  signature—: string;
  amount: number;
  currency: string;
  plan: 'one-time' | 'monthly' | 'yearly' | 'lifetime';
  status: 'created' | 'paid' | 'failed' | 'refunded';
  method—: string;
  description—: string;
  razorpayOrderId—: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    paymentId: String,
    signature: String,
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    plan: {
      type: String,
      enum: ['one-time', 'monthly', 'yearly', 'lifetime'],
      required: true,
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
    },
    method: String,
    description: String,
    razorpayOrderId: String,
  },
  {
    timestamps: true,
  }
);

export const Payment = mongoose.model<IPayment>(
  'Payment',
  paymentSchema
);