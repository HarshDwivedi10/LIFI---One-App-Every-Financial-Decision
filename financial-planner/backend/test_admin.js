const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/admin/dashboard',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiUk9MRV9BRE1JTiIsInN1YiI6ImFkbWluQGZpbmFuY2VwbGFubmVyLmNvbSIsImlhdCI6MTc4NTUzNDMxMSwiZXhwIjoxNzg1NjIwNzExfQ._7OpGapt_AwCkJjfmcfHksiBF0WOdXG5flVeogGHzmg'
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let data = '';
  res.on('data', d => {
    data += d;
  });
  res.on('end', () => {
      console.log(data);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
