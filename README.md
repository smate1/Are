# ERA Social Platform

A social media platform for travelers to share experiences and connect with others.

## Features

- User authentication (login/registration)
- Profile management with avatar upload
- Map integration
- Chat functionality
- Dark mode support

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (optional)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd era_project
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

4. Open your browser to [http://localhost:5002](http://localhost:5002)

## Development

### Available Scripts

- `npm start`: Start the simple server with mock functionality
- `npm run dev`: Start the server with nodemon for automatic reloading
- `npm run full`: Start the full server with MongoDB connection (requires MongoDB)

### Mock Mode

By default, the application runs in mock mode, which doesn't require a MongoDB connection.
This enables easy development and testing without setting up a database.

The mock mode provides:
- Sample user authentication
- Profile data
- Avatar update simulation

### Database Setup

To use the application with a real database:

1. Install MongoDB or set up a MongoDB Atlas account
2. Configure the connection string in `index.js`
3. Run the server with `npm run full`

## Project Structure

- `/models`: Database models
- `/middleware`: Express middleware
- `/public`: Static files
  - `/css`: Stylesheets
  - `/js`: Client-side JavaScript
  - `/images`: Images and icons
- `/`: Server-side JavaScript

## Login Credentials (Mock Mode)

You can use any username/email and password combination in mock mode, but the password must be longer than 3 characters.

## License

ISC
# Are
