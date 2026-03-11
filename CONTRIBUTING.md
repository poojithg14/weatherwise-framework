# Contributing to WeatherWise

Thank you for your interest in contributing to WeatherWise. This guide explains how to get involved.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/weatherwise-framework.git`
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Make your changes
5. Run tests (see below)
6. Commit and push to your fork
7. Open a Pull Request against `main`

## Development Setup

### Prerequisites

- Java 17+ (OpenJDK recommended)
- Maven 3.9+ (or use the included Maven wrapper)
- Node.js 18+ and npm
- Python 3.9+
- PostgreSQL 16 with PostGIS 3.4 (or use Docker Compose)

### Running Locally

```bash
# Backend
cd backend
bash mvnw spring-boot:run

# Frontend
cd frontend
npm install
npm run dev

# ML service
cd ml
pip install -r requirements.txt
python ml_service.py
```

### Using Docker Compose

```bash
docker-compose up --build
```

## Running Tests

```bash
# Backend (Java)
cd backend
bash mvnw test

# Frontend (Vitest)
cd frontend
npm test

# All tests
bash run_all_tests.sh
```

All tests must pass before submitting a PR.

## Code Style

- **Java**: Follow standard Spring Boot conventions. Use Lombok where appropriate.
- **React/JSX**: Functional components with hooks. Tailwind CSS for styling.
- **Python**: PEP 8. Pin dependency versions in requirements.txt.

## What to Contribute

- Bug fixes with test coverage
- New weather data source integrations
- Performance improvements with benchmarks
- Documentation improvements
- New hazard type support
- Mobile responsiveness fixes
- Accessibility improvements

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- Add or update tests for any new functionality
- Ensure `npm run build` and `mvnw test` pass
- Reference related issues (e.g., "Fixes #12")

## Reporting Issues

- Use the GitHub issue templates for bugs and feature requests
- Include steps to reproduce for bug reports
- Include your environment (OS, Java version, Node version)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
