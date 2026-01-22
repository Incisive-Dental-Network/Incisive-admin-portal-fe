# Incisive User Frontend

A Next.js admin dashboard for managing dynamic database tables with authentication, CRUD operations, and data export features.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+
- Backend API server running

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd incisive-user-fe
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

> Update `NEXT_PUBLIC_API_URL` to point to your backend API server.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3001 |
| `npm run build` | Build for production |
| `npm start` | Start production server on port 3001 |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (protected)/        # Authenticated routes
│   │   ├── dashboard/      # Dashboard page
│   │   ├── tables/         # Dynamic table pages
│   │   └── profile/        # User profile
│   ├── api/                # API route handlers (proxy)
│   └── login/              # Authentication pages
├── components/
│   ├── layout/             # Layout components (Header, Sidebar)
│   ├── tables/             # Table components (DataTable, DynamicForm)
│   ├── ui/                 # Reusable UI components
│   └── providers/          # Context providers
├── config/                 # Configuration constants
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
├── store/                  # Zustand stores
└── types/                  # TypeScript type definitions
```

## Features

- User authentication with JWT tokens
- Dynamic table management (CRUD operations)
- Role-based permissions
- Data filtering, sorting, and pagination
- CSV data export
- Dark mode support
- Responsive design

## API Configuration

The frontend proxies all API requests through Next.js API routes to handle authentication tokens. The proxy automatically:

- Adds Authorization headers from cookies
- Refreshes expired tokens
- Handles token rotation

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:3000/api/v1` |

## License

Private
