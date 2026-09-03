import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    // This is the single most common Render misconfiguration for this service:
    // render.yaml does not carry secrets, so if MONGODB_URI was never added in
    // the dashboard the container used to exit(1) with a vague message and
    // crash-loop forever. Make the cause unmistakable in the logs.
    console.error(
      '\n❌ FATAL: MONGODB_URI is not set.\n' +
      '   The backend cannot start without it.\n' +
      '   On Render: Dashboard > your service > Environment > Add MONGODB_URI\n' +
      '   Also required: JWT_SECRET, FRONTEND_URL\n'
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      family: 4
    });

    console.log('✅ MongoDB Connected Successfully');
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error?.message || error);
    console.error('   Check the connection string and that Render\'s outbound IPs are allowed in MongoDB Atlas (Network Access).');
    process.exit(1);
  }
};