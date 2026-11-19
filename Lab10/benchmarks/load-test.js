import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  insecureSkipTLSVerify: true,
  stages: [
    { duration: '10s', target: 15 },
    { duration: '20s', target: 40 },
    { duration: '15s', target: 80 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  const resGo = http.get('https://localhost/api/reports');
  check(resGo, { 'go 200': (r) => r.status === 200 });

  const resNode = http.get('https://localhost/health');
  check(resNode, { 'node 200': (r) => r.status === 200 });

  sleep(0.05);
}