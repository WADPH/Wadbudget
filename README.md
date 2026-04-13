# Wadbudget
Wadbudget - simple NodeJS project that helps you plan your finance

## Install
npm install

## Run
npm start

## API

GET /plan/2026-04

POST /item
{
  "month": "2026-04",
  "type": "Fixed",
  "name": "Test",
  "amount": 100
}

DELETE /item
{
  "month": "2026-04",
  "type": "Fixed",
  "name": "Test"
}

POST /next-month
{
  "month": "2026-04",
  "newMonth": "2026-05"
}