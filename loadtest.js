import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// --- CẤU HÌNH ---
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImVtYWlsIjoiYnVmZnNlcnZlM0BnbWFpbC5jb20iLCJyb2xlIjoiUEFTU0VOR0VSIiwiaWF0IjoxNzY0NDQ0NDQ5LCJleHAiOjE3NjQ0NDcxNDl9.CQ7RbCwLrihhTjgt28krxn1ZHOH8AyRDYTZMKYUTCwM"; // <--- DÁN TOKEN
const BASE_URL = 'http://uit-go-alb-1656520093.ap-southeast-1.elb.amazonaws.com'; 

const scenarios = {
  smoke: {
    stages: [{ duration: '30s', target: 200 },
      { duration: '1m',  target: 200 },
      { duration: '30s', target: 0 },],
  },
  load: {
    stages: [{ duration: '30s', target: 1000 },
      { duration: '2m',  target: 1000 },
      { duration: '30s', target: 0 },],
  },
  stress: {
    stages: [{ duration: '1m', target: 2500 }, 
      { duration: '3m', target: 2500 },
      { duration: '1m', target: 0 },
],
  },				
  spike: {
    stages: [
      { duration: '10s', target: 100 },
      { duration: '20s', target: 5000 }, 
      { duration: '1m',  target: 5000 },
      { duration: '30s', target: 0 },
    ],
  },
};

const type = __ENV.TYPE || 'smoke';
const selectedScenario = scenarios[type];

export const options = {
  stages: selectedScenario.stages,
  thresholds: {
    'http_req_duration{type:WRITE}': ['p(95)<60000'], 
    'http_req_duration{type:READ}': ['p(95)<60000'],
    'checks{type:WRITE}': ['rate>0.1'], // Ít nhất 10% đặt xe thành công
    'checks{type:READ}': ['rate>0.1'],  // Ít nhất 10% xem được trạng thái
  },
};

function getRandomLoc() {
  return {
    lat: 10.772 + (Math.random() * 0.01 - 0.005),
    lng: 106.698 + (Math.random() * 0.01 - 0.005)
  };
}

export default function () {
  let myTimeout = '60s';
  let mySleep = 0.5; 

  if (type === 'stress') {
    myTimeout = '10s'; 
    mySleep = 0.8;
  } else if (type === 'spike') {
    myTimeout = '5s';
    mySleep = 0.1;    
  }

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    timeout: myTimeout,
  };

  // --- HÀNH ĐỘNG ĐỌC ĐỘC LẬP (READ) ---
  const searchParams = Object.assign({}, params, { tags: { type: 'READ' } });
  const resSearch = http.get(`${BASE_URL}/drivers/search?lat=10.776&lng=106.700&radius=5&unit=km`, searchParams);
  check(resSearch, {
    'Search Drivers Success': (r) => r.status === 200
  }, { type: 'READ' });


  // --- HÀNH ĐỘNG 1: GHI (WRITE) ---
  const loc = getRandomLoc();
  const body = JSON.stringify({
    from_lat: loc.lat, from_lng: loc.lng,
    to_lat: 10.776, to_lng: 106.703
  });

  const postParams = Object.assign({}, params, { tags: { type: 'WRITE' } });
  const resPost = http.post(`${BASE_URL}/trips`, body, postParams);
  if (resPost.status !== 201 && resPost.status !== 400) {
    console.error(`Lỗi API: ${resPost.status} - Body: ${resPost.body}`);
  }
  const isCreated = check(resPost, { 
    'Booking Success': (r) => r.status === 201 || r.status === 400 
  }, { type: 'WRITE' });

  let tripId;
  if (resPost.status === 201) {
     try { tripId = resPost.json('id'); } catch(e) {}
  }

  // --- HÀNH ĐỘNG 2: ĐỌC (READ) ---
  if (tripId) {
    const getParams = Object.assign({}, params, { tags: { type: 'READ' } });
    const resGet = http.get(`${BASE_URL}/trips/${tripId}`, getParams);
    check(resGet, { 
        'View Status Success': (r) => r.status === 200 
    }, { type: 'READ' });
  }

  sleep(mySleep); 
}

export function handleSummary(data) {
  const filename = `report_${type}_2911.html`;
  return { [filename]: htmlReport(data) };
}
