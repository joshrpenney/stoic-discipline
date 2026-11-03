# Stoic Strava API Worker

This Cloudflare Worker handles Strava OAuth, securely stores Strava tokens in the `STOIC_STRAVA_TOKENS` KV namespace, and exposes authenticated running-activity endpoints for the Stoic Discipline app.

Deployment is configured by the repository-root `wrangler.jsonc` file.
