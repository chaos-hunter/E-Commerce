# E-commerce Basket and RFM Patterns

Welcome to the **E-commerce Basket and RFM Patterns** project! This is a comprehensive, full-scale software application designed to analyze e-commerce customer transaction data using **RFM (Recency, Frequency, Monetary)** patterns. 

RFM is a proven marketing model for behavior-based customer segmentation. It groups customers based on their transaction history – how recently, how often, and how much they bought. This application provides insights and visualizations into customer purchasing behavior, enabling data-driven marketing decisions.

---

## 🏗️ Architecture & Tech Stack

This project follows a modern, containerized, three-tier architecture:

*   **Frontend (User Interface):** 
    *   Framework: **React** (v17) 
    *   Language: **TypeScript**
    *   Data Visualization: **Recharts**
    *   Build Tool & Package Manager: **NPM** (via Create React App / `react-scripts`)
*   **Backend (API & Business Logic):** 
    *   Framework: **Spring Boot** (Java)
    *   Build Tool: **Gradle**
    *   Database Migrations: **Flyway**
*   **Database (Data Persistence):** 
    *   Engine: **MySQL / MariaDB**
*   **Infrastructure & Deployment:**
    *   Containerization: **Docker**
    *   Orchestration: **Docker Compose**

---

## 🚀 Getting Started

Follow these step-by-step instructions to get a copy of the project running locally on your machine for development and testing purposes.

### Prerequisites

You will need the following tools installed on your local machine:
*   [Git](https://git-scm.com/)
*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/)

### Local Setup Instructions

1.  **Clone the repository:**
    Open your terminal or command prompt and run:
    ```bash
    git clone https://github.com/chaos-hunter/E-Commerce-Analytics-Dashboard.git
    cd e-commerce-basket_rfm-patterns
    ```

2.  **Start the infrastructure using Docker Compose:**
    The project is pre-configured to spin up the database, backend API, and frontend client with a single command. From the root directory, run:
    ```bash
    docker compose up --build
    ```
    *Note: The `--build` flag ensures that the latest changes to your Dockerfiles are built. You can omit it on subsequent runs if dependencies haven't changed.*

3.  **Access the application:**
    Once the containers are successfully built and running, you can access the services at the following local URLs:
    *   **Frontend Web App:** [http://localhost:3000](http://localhost:3000)
    *   **Backend API:** [http://localhost:8080](http://localhost:8080)
    *   **Database:** Exposed externally on `localhost:3307` (Internal Docker network uses port `3306`)

4.  **Stopping the application:**
    To stop all running services gracefully, use:
    ```bash
    docker compose down
    ```

---

## 🧪 Testing

This project incorporates testing at various layers of the stack to ensure reliability and correctness. The testing strategy is split across the frontend, backend, and full-scale integration tests.

### 1. Frontend Tests (React)
The frontend uses Jest and React Testing Library. To run tests and generate a coverage report:
```bash
cd frontend
npm install
npm run test:coverage
```
*To run tests in interactive watch mode, simply use `npm test`.*

### 2. Backend Tests (Spring Boot)
The backend uses standard Java testing frameworks (JUnit/Mockito). To run the API unit and integration tests via Gradle:
```bash
cd backend
./gradlew test
```

### 3. System Integration Tests (Playwright/Node)
Comprehensive end-to-end (E2E) UI and API integration tests are set up using **Playwright**. These tests validate that the frontend, backend, and database interact correctly.
To run the integration suite:
```bash
cd integration
npm install

# Run all integration tests
npm test

# Alternatively, run scope-specific tests:
npm run test:frontend
npm run test:backend
npm run test:ui
```
*Note: Make sure the application is fully running via Docker Compose before executing the integration UI/E2E tests, as they test against the active services.*

---

## 🗄️ Database Management
The application manages its database schema via **Flyway**. When the backend container starts, Flyway automatically executes the SQL migration scripts located in `./database/scripts` to define the schema and populate any initial foundational data. 

## 🛠️ Continuous Integration (CI)
This repository includes an automated pipeline configured via `.gitlab-ci.yml`. This pipeline runs tests during the build phase and triggers the Playwright integration suite using `npm run test:ci` to guarantee stability upon code merges.
