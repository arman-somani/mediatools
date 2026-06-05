import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load .env relative to this file's location
dotenv.config({ path: path.join(__dirname, '.env') });

// Assume User and Conversion models are available
import { User } from './src/models/User';
import { Conversion } from './src/models/Conversion';
import { connectDB } from './src/config/database';

const TARGET_EMAIL = 'arman.somani129354@marwadiuniversity.ac.in';

async function run() {
  try {
    await connectDB();
    console.log('Connected to DB');

    const user = await User.findOne({ email: TARGET_EMAIL });
    
    if (!user) {
      console.log(`User with email ${TARGET_EMAIL} not found.`);
      process.exit(0);
    }

    console.log(`Found user: ${user._id} (${user.name})`);

    const delConversions = await Conversion.deleteMany({ userId: user._id.toString() });
    console.log(`Deleted ${delConversions.deletedCount} conversions linked to this user.`);

    const delUser = await User.deleteOne({ _id: user._id });
    console.log(`Deleted user ${TARGET_EMAIL}.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

run();
