# Project Name

A web application built with a Node.js backend and a frontend using Vanilla JavaScript, EJS templating, and Bootstrap for styling.

## Project Structure

```
.
├── backend                   # Backend source code (Node.js)
├── default-user-password.xml  # Configuration file for default user credentials
├── docker-compose.yaml       # Docker Compose configuration for services
├── index.js                  # Entry point for the Node.js application
├── package-lock.json         # NPM dependency lock file
├── package.json              # NPM configuration and dependencies
├── public                    # Frontend static assets
│   ├── drag.js               # JavaScript for drag functionality
│   ├── index.css             # Custom CSS styles
│   ├── index.js              # Main frontend JavaScript
│   └── sample.js             # Sample JavaScript file
└── views                     # EJS templates
    ├── pages                 # Main page templates
    │   ├── drag.ejs          # EJS template for drag & drop page
    │   └── index.ejs         # EJS template for index page
    └── partials              # Reusable EJS partials
        ├── header.ejs        # Header partial
        └── nav.ejs           # Navigation partial
```

## Technologies Used

- **Frontend**: Vanilla JavaScript, EJS, Bootstrap
- **Backend**: Node.js

## Prerequisites

- [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed

## Setup and Running

1. **Clone the repository**:

   ```bash
   git clone https://github/rajatmohan22/ClickHouseUI
   cd ClickHouseUI
   ```

2. **Run Docker Compose**:
   In the root directory, start the services defined in `docker-compose.yaml`:

   ```bash
   docker-compose up -d
   ```

3. **Start the development server**:
   In the root directory, run:
   ```bash
   npm run dev
   ```

## Notes

- Ensure you are in the **root directory** when running the above commands.
- The application uses a Node.js backend with EJS for server-side rendering and Vanilla JavaScript with Bootstrap for the frontend.

## Download

You can download the project from the [repository URL](#) (replace with the actual repository link).
