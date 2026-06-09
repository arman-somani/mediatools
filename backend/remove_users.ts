import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User';

dotenv.config();

const emailsToRemove = [
  'armansomani786@proton.me',
  'armansomani7868@proton.me',
  'a@a.com',
  'a@gmail.com',
  'b@gmail.com',
  'c@gmail.com',
  'qwertyuiop@gmail.com',
  'f@gmail.com'
];

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  const result = await User.deleteMany({ email: { $in: emailsToRemove } });
  console.log('Successfully deleted ' + result.deletedCount + ' users.');
  process.exit(0);
}).catch(console.error);
