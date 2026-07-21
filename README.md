# Hiccup Tracker

Small internal operations app for collecting, tracking, exporting, and summarizing monthly logistics hiccups.

## Stack

- Backend: FastAPI, SQLAlchemy
- Database: SQLite for the MVP, with tables for users, departments, hiccups, comments, status history, and attachments
- Frontend: React + Vite
- Docker Compose: runs the frontend, backend, SQLite data volume, and upload volume

## Project Structure

```text
backend/
  Dockerfile
  app/
    main.py          FastAPI routes and business rules
    models.py        SQLAlchemy database models
    schemas.py       API schemas
    seed.py          Database initialization and sample data
    database.py      SQLite connection
    uploads/         Uploaded attachment files
  requirements.txt
frontend/
  Dockerfile
  nginx.conf
  src/
    components/
    pages/
    api.js
    App.jsx
    main.css
  package.json
docker-compose.yml
README.md
```

## Docker Setup

Run the whole app in Docker:

```bash
docker compose up --build
```

Open:

```text
http://127.0.0.1:5173
```

The API is exposed on:

```text
http://127.0.0.1:8010
```

Login with the seeded admin account:

```text
Email: admin@kienticsgroup.com
Password: Kinetics@123
```

Admins can create additional users from **Admin Settings** with a name, username, email, role, department, and password. Users must log in with their own email address and password.

The SQLite database is stored in the Docker volume `hiccup_data`. Uploaded files are stored in `hiccup_uploads`.

Stop the app:

```bash
docker compose down
```

Reset all Docker data and reseed the sample database:

```bash
docker compose down -v
docker compose up --build
```

## Local Setup Without Docker

Create and seed the SQLite database:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed
```

Run the API:

```bash
uvicorn app.main:app --reload
```

If port `8000` is blocked, use another port:

```bash
uvicorn app.main:app --reload --port 8010
```

Run the React app in another terminal:

```bash
cd frontend
npm install
npm run dev
```

When the API is not on `8000`, start the frontend with:

```bash
set VITE_API_BASE=http://127.0.0.1:8010
npm run dev
```

Open `http://127.0.0.1:5173`.

## User Roles

- Employee: submits hiccups and views own submissions
- Department Head: views department hiccups
- Admin: views all, updates status, exports, sees settings
- Manager: dashboard and monthly summaries

The login screen requires a saved user email and that user's password. The API accepts `user_id` for scope checks so fuller session/token authentication can be added later.

## Exports

- Hiccup list CSV: `/api/export/hiccups.csv`
- Hiccup list XLSX: `/api/export/hiccups.xlsx`
- Monthly summary Excel report: `/api/export/monthly-summary.xlsx?month=7&year=2026`
- Printable monthly summary: `/api/export/monthly-summary.html?month=7&year=2026`

## Business Rules

- Closing a hiccup sets `closed_at` automatically.
- Reopening a closed hiccup clears `closed_at`.
- Status changes create `status_history` records.
- Open, In Progress, Repeated, and Escalated hiccups older than 7 days are overdue.
- Monthly summary text is rule-based in `generate_rule_based_summary`.
- `generate_ai_summary_placeholder` is the clean plug-in point for a future OpenAI or internal AI summary.
