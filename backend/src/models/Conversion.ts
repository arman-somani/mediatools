import mongoose, { Document, Schema } from 'mongoose';

export interface IConversion extends Document {
  userId?: string;
  type: 'mp4' | 'youtube' | 'youtube-mp4' | 'universal';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  originalName?: string;
  youtubeUrl?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
  outputFilename?: string;
  outputPath?: string;
  outputUrl?: string;
  quality: '128' | '192' | '320';
  videoQuality?: '360p' | '480p' | '720p' | '1080p' | '4K' | '8K';
  fileSize?: number;
  duration?: number;
  errorMessage?: string;
  progress: number;
  expiresAt: Date;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const conversionSchema = new Schema<IConversion>(
  {
    userId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: ['mp4', 'youtube', 'youtube-mp4', 'universal'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    originalName: String,
    youtubeUrl: String,
    youtubeTitle: String,
    youtubeThumbnail: String,
    outputFilename: String,
    outputPath: String,
    outputUrl: String,
    quality: {
      type: String,
      enum: ['128', '192', '320'],
      default: '192',
    },
    videoQuality: {
      type: String,
      enum: ['360p', '480p', '720p', '1080p', '4K', '8K'],
    },
    fileSize: Number,
    duration: Number,
    errorMessage: String,
    progress: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

conversionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

export const Conversion = mongoose.model<IConversion>(
  'Conversion',
  conversionSchema
);