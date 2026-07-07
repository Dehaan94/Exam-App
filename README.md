# Exam Practice Hub

This is a lightweight interactive quiz app that loads exam questions from a JSON data file and lets you switch between multiple exam sets.

## How to use

1. Open `index.html` in your browser.
2. Choose an exam set from the dropdown.
3. Select an answer and click `Show Answer`.
4. Continue with `Next Question` or restart the quiz.

## Files

- `index.html` — the app user interface
- `style.css` — styling for the quiz app
- `script.js` — quiz logic and answer handling
- `server.js` — Node/Express backend that fetches questions from PostgreSQL
- `package.json` — Node dependencies and start script
- `.gitignore` — files that should not be committed
- `.env.example` — example environment variables file

## Database setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to your PostgreSQL connection string.
3. Run `npm install`.
4. Start the app with `npm start`.

The frontend now loads questions from `/api/questions` instead of the local JSON file.
