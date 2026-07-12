
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { WindowEvent } from './src/features/agent/agent.model';
import Device from './src/features/devices/devices.model';
mongoose.connect(process.env.MONGO_URI as string).then(async () => {
  const device = await Device.findOne({ childId: new mongoose.Types.ObjectId('6a4e837ba197ce604930cfea') });
  console.log('device_id', device?._id);
  const agg = await WindowEvent.aggregate([
    { $match: { deviceId: device?._id, dateKey: '2026-07-12' } },
    { $count: 'count' }
  ]);
  console.log('Aggregation result with device._id directly:', agg);

  const agg2 = await WindowEvent.aggregate([
    { $match: { deviceId: new mongoose.Types.ObjectId(device?._id as string), dateKey: '2026-07-12' } },
    { $count: 'count' }
  ]);
  console.log('Aggregation result with new ObjectId():', agg2);
  
  process.exit(0);
});

