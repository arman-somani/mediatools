require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const conversions = await db.collection('conversions').find({ _id: new mongoose.Types.ObjectId('6a266995cc551178545e3974') }).toArray();
    console.log(conversions);
    process.exit(0);
  });
