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

const SEARCH_STEPS = [1, 3, 5, 10]; 

async function processTrip(tripId: string, coords: { lat: number, lng: number }, excludeDriverIds: number[] = []) {
  console.log(`[Worker] Processing trip ${tripId}...`);
  
  let foundDriver = null;

  for (const radius of SEARCH_STEPS) {
    console.log(`[Worker] Trying search radius: ${radius} km...`);
    
    try {
      const { data } = await axios.get(`${DRIVER_SERVICE_URL}/drivers/search`, {
        params: {
          lat: coords.lat,
          lng: coords.lng,
          radius: radius,
          unit: 'km',
          excludeDriverIds: excludeDriverIds.length > 0 ? excludeDriverIds.join(',') : undefined 
        }
      });

      if (data.count > 0 && data.drivers[0]) {
        foundDriver = data.drivers[0];
        console.log(`[Worker] Found driver ${foundDriver.id} at radius ${radius}km (Dist: ${foundDriver.distance}km)`);
        break; 
      }
      
    } catch (err) {
      console.error(`[Worker] Error calling Driver Service at radius ${radius}km:`, err);
    }
  }

  if (foundDriver) {
    try {
      await axios.post(`${TRIP_SERVICE_URL}/internal/trips/${tripId}/driver-found`, {
        driverId: foundDriver.id
      });
      console.log(`[Worker] Notified TripService regarding driver ${foundDriver.id}`);
    } catch (err) {
      console.error(`[Worker] Failed to notify TripService:`, err);
    }

  } else {
    console.log(`[Worker] Exhausted all search radius. No driver for trip ${tripId}`);
    try {
      await axios.post(`${TRIP_SERVICE_URL}/internal/trips/${tripId}/driver-not-found`, {});
      console.log(`[Worker] Sent [Not Found] signal to TripService for trip ${tripId}`);
    } catch (err) {
      console.error(`[Worker] Failed to report Not Found to TripService:`, err);
    }
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

          try {
            await processTrip(body.tripId, body.coords, body.excludeDriverIds || []);
            await sqs.send(new DeleteMessageCommand({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: msg.ReceiptHandle
            }));
          } catch (err) {
            console.error(`[Worker] Error processing trip ${body.tripId}:`, err);
            // Do not delete the message, so it can be retried
          }
        }
      }
    } catch (error) {
      console.error("[Worker] Polling error:", error);
      await new Promise(r => setTimeout(r, 5000)); 
    }
  }
}
start();