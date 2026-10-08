import mongoose, { Schema, Document, Types } from 'mongoose';
import { Role, ROLES } from '../permissions';

export interface IUser extends Document {
  name: string;
  username: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  phone?: string;
  mustChangePassword: boolean;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  pinHash?: string;
  pinSetAt?: Date;
  approvalPinFailedAttempts: number;
  approvalPinLockedUntil?: Date;
  loginPinHash?: string;
  mustChangePin: boolean;
  loginPinFailedAttempts: number;
  loginPinLockedUntil?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-z0-9._-]+$/, 'Username can only contain lowercase letters, numbers, dots, hyphens, and underscores'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never return or leak password hash in standard queries
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    pinHash: {
      type: String,
      select: false, // 6-digit manager approval PIN hash
    },
    pinSetAt: {
      type: Date,
    },
    approvalPinFailedAttempts: {
      type: Number,
      default: 0,
    },
    approvalPinLockedUntil: {
      type: Date,
    },
    loginPinHash: {
      type: String,
      select: false, // 4-digit fast login PIN hash
    },
    mustChangePin: {
      type: Boolean,
      default: false,
    },
    loginPinFailedAttempts: {
      type: Number,
      default: 0,
    },
    loginPinLockedUntil: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', userSchema);
