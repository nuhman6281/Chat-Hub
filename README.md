# EventSentinel Chat Application

A full-stack chat application featuring real-time messaging, workspaces, channels, direct messages, and user authentication. Built with React, TypeScript, Node.js, Express, Vite, PostgreSQL, and Drizzle ORM.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Shadcn UI, Zustand (or Context API), React Query, Wouter
- **Backend:** Node.js, Express, TypeScript, tsx
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Real-time:** WebSockets
- **Authentication:** Passport.js (Local Strategy), Express Sessions, JWT

## Project Structure

```
.
├── client/         # Frontend React/Vite application
│   ├── public/
│   └── src/
│       ├── components/
│       ├── contexts/
│       ├── hooks/
│       ├── lib/
│       ├── pages/
│       └── types/
├── migrations/     # Drizzle ORM migrations
├── server/         # Backend Express application
├── shared/         # Code shared between client/server (e.g., DB schema)
├── node_modules/
├── .env.example    # Example environment variables (Create a .env file)
├── .gitignore
├── drizzle.config.ts
├── package.json
├── README.md
└── tsconfig.json
└── vite.config.ts
└── ... other config files
```

## Setup and Installation

**Prerequisites:**

- Node.js (LTS version recommended)
- npm or yarn
- PostgreSQL Server running

**Steps:**

1.  **Clone the repository (if applicable):**

    ```bash
    git clone <your-repo-url>
    cd EventSentinel
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**

    - Create a `.env` file in the project root (copy from `.env.example` if it exists).
    - Add the following variables, replacing placeholders with your actual values:

      ```dotenv
      # PostgreSQL Connection URL
      DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database_name>

      # Session Secret (choose a strong, random string)
      SESSION_SECRET=your_strong_session_secret

      # JWT Secret (choose a strong, random string)
      JWT_SECRET=your_strong_jwt_secret

      # Optional: Set Node environment (development/production)
      # NODE_ENV=development
      ```

4.  **Database Setup:**

    - Ensure your PostgreSQL server is running and the database specified in `DATABASE_URL` exists.
    - Apply database migrations (if using Drizzle Kit migrations):

      ```bash
      # Generate migrations (if schema changes were made)
      # npx drizzle-kit generate

      # Apply migrations (adjust command based on your setup)
      # npx drizzle-kit push # or migrate
      npm run db:push # Uses the script defined in package.json
      ```

## Running the Application

**Development:**

- Starts the backend server and the Vite dev server with HMR.
- Ensure your `.env` file is configured or pass variables directly.

  ```bash
  # Using .env file (recommended)
  npm run dev

  # Or passing variables directly (Example 1)
  # DATABASE_URL=... SESSION_SECRET=... NODE_ENV=development npm run dev

  # Specific example used during setup:
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/event_sentinel SESSION_SECRET=event-sentinel-secret-key NODE_ENV=development npm run dev
  ```

- Access the application at `http://localhost:3000` (or the configured port).

**Production Build:**

1.  **Build the frontend and backend:**

    ```bash
    npm run build
    ```

    This typically builds the client assets into `dist/public` and the server into `dist`.

2.  **Start the production server:**
    - Ensure **production** environment variables are set (especially secrets and `NODE_ENV=production`).
    - Ensure your database is running and accessible.
    ```bash
    npm run start
    ```

## Key Features

- Real-time messaging via WebSockets
- Workspaces, Channels, and Direct Messages
- User Authentication (Login/Register/Logout)
- Session Management & JWT support
- Database persistence with PostgreSQL & Drizzle
- Modern UI with React, TypeScript, and Tailwind CSS
