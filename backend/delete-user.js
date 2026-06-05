require('dotenv').config();
const mongoose = require('mongoose');

async function deleteUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    const result = await usersCollection.deleteOne({ email: 'armansomani786@gmail.com' });
    
    if (result.deletedCount === 1) {
      console.log("SUCCESS: User armansomani786@gmail.com was deleted!");
    } else {
      console.log("WARNING: User not found. They might already be deleted.");
    }
  } catch (error) {
    console.error("ERROR:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

deleteUser();
