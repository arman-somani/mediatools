import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  googleId?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiry?: Date;
  emailVerificationAttempts: number;
  /** SHA-256 of the reset token. The raw token only ever exists in the email. */
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  isPremium: boolean;
  subscriptionType: 'free' | 'monthly' | 'yearly' | 'lifetime';
  subscriptionExpiry?: Date;
  totalConversions: number;
  totalDownloads: number;
  monthlyConversionsUsed: number;
  monthlyConversionsLimit: number;
  monthlyBandwidthUsed: number;
  lastBandwidthReset: Date;
  role: 'user' | 'admin';
  isBanned: boolean;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    avatar: {
      type: String,
    },
    googleId: {
      type: String,
      sparse: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpiry: {
      type: Date,
    },
    // A 6-digit code has only 10^6 possibilities and lives for 24h. Per-IP
    // rate limiting alone does not close that, so failed attempts are counted
    // against the account itself and the code is burned after 5 misses.
    emailVerificationAttempts: {
      type: Number,
      default: 0,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpiry: {
      type: Date,
    },
    isPremium: {
      type: Boolean,
      default: true,
    },
    subscriptionType: {
      type: String,
      enum: ['free', 'monthly', 'yearly', 'lifetime'],
      default: 'lifetime',
    },
    subscriptionExpiry: {
      type: Date,
    },
    totalConversions: {
      type: Number,
      default: 0,
    },
    totalDownloads: {
      type: Number,
      default: 0,
    },
    monthlyConversionsUsed: {
      type: Number,
      default: 0,
    },
    monthlyConversionsLimit: {
      type: Number,
      default: 999999,
    },
    monthlyBandwidthUsed: {
      type: Number,
      default: 0,
    },
    lastBandwidthReset: {
      type: Date,
      default: Date.now,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    lastActiveAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);