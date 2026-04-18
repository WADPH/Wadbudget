# Wadbudget
Wadbudget - simple NodeJS project that helps you plan your finance

## Install
npm install

## Auth Setup (Google SSO Required)
1. Copy `.env.example` to `.env`
2. Fill:
- `ALLOWED_USERS=user1@gmail.com,user2@gmail.com`
- `CLIENT_ID=...`
- `CLIENT_SECRET=...`
- `SESSION_SECRET=...` (long random value)
3. In Google Cloud OAuth client settings, add redirect URI:
- `http://localhost:3001/auth/callback`
4. Start app and open:
- `http://localhost:3001`

## Run
npm start

## API

All API routes require an authenticated Google account in `ALLOWED_USERS`.

GET /plan/05.2026

POST /item
{
  "month": "05.2026",
  "type": "Fixed",
  "name": "Test",
  "amount": 100
}

DELETE /item
{
  "month": "05.2026",
  "type": "Fixed",
  "name": "Test"
}

POST /next-month
{
  "month": "05.2026",
  "newMonth": "06.2026"
}
