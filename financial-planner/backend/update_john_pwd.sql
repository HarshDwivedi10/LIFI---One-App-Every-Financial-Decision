USE finance_planner;
UPDATE users SET password='$2b$10$b0AFyRKWQxKBuB4hv7zLK.emD1Go5iq8k27H38K/WZljIpYWX0XC.' WHERE email='john.sharma@lifi.com';
SELECT email, LENGTH(password) as hash_length FROM users WHERE email='john.sharma@lifi.com';
