import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";

import axios from 'axios';


const sqs = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});
const QUEUE_URL = process.env.SQS_QUEUE_URL || '';
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL ||'';
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || 'http://trip-service:3002';

async function processTrip(tripId: string, coords: { lat: number, lng: number }) {
  console.log(`[Worker]Processing trip ${tripId}...`);
  
  try {
    const { data } = await axios.get(`${DRIVER_SERVICE_URL}/drivers/search`, {
      params: {
        lat: coords.lat,
        lng: coords.lng,
        radius: 5,
        unit: 'km'
      }
    });

    if (data.count > 0 && data.drivers[0]) {
      const driver = data.drivers[0];
      console.log(`[Worker]Found driver ${driver.id} for trip ${tripId}`);

      await axios.post(`${TRIP_SERVICE_URL}/internal/trips/${tripId}/driver-found`, {
        driverId: driver.id
      });

      // TODO: Gửi event bắn WebSocket 
    } else {
      console.log(`[Worker] No driver found for trip ${tripId}`);
    }
  } catch (err) {
    console.error(`[Worker] Error processing trip ${tripId}:`, err);
  }
}

async function start() {
  console.log("Worker Service is running...");
  
  while (true) {
    try {
      const { Messages } = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20, 
      }));

      if (Messages && Messages.length > 0) {
        for (const msg of Messages) {
          if (!msg.Body) continue;
          const body = JSON.parse(msg.Body);

          await processTrip(body.tripId, body.coords);
          await sqs.send(new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: msg.ReceiptHandle
          }));
        }
      }
    } catch (error) {
      console.error("[Worker] Polling error:", error);
      await new Promise(r => setTimeout(r, 5000)); 
    }
  }
}
start();