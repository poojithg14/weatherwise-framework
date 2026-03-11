# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in WeatherWise, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, email: **weatherwise@proton.me**

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge your report within 48 hours and provide a timeline for a fix.

## Safety Disclaimer

WeatherWise is a research framework and **must not be used as the sole basis for life-safety decisions**. Always follow official guidance from the National Weather Service (NWS) and local emergency management agencies. The system is designed to supplement, not replace, official weather warnings.

## Scope

The following are in scope for security reports:

- Authentication/authorization bypasses
- SQL injection or GraphQL injection
- Cross-site scripting (XSS)
- Server-side request forgery (SSRF)
- Exposure of sensitive data (API keys, credentials)
- Dependency vulnerabilities with known exploits

## Acknowledgments

We appreciate the security research community and will credit reporters (with permission) in our release notes.
