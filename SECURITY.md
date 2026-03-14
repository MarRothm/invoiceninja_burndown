# Security Policy

## Supported Versions

This project is self-hosted and maintained on a best-effort basis.
The latest version on the `main` branch is always the supported version.

## Reporting a Vulnerability

Please **do not** report security vulnerabilities via public GitHub Issues.

Instead, open a [GitHub Security Advisory](https://github.com/MarRothm/burndown/security/advisories/new)
or send a brief description to the repository owner via the GitHub profile contact.

We will respond as quickly as possible and coordinate a fix before any public disclosure.

## Scope

This tool is designed to run **locally or in a private network** (Docker Compose, Portainer).
It is **not** intended to be exposed directly to the public internet without additional
authentication and access controls in front of it.

Known accepted risks in a local-only deployment:
- The API has no built-in authentication (by design — it trusts the network boundary)
- All project data from InvoiceNinja is accessible to anyone who can reach the API port

If you run this on a public-facing server, add authentication (e.g. HTTP Basic Auth via
your reverse proxy, or a VPN/firewall rule) in front of the service.
