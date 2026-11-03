const STRAVA_AUTHORIZE = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";
const REDIRECT_URI = "https://stoic-strava-api.joshrpenney.workers.dev/strava/callback";
const FIREBASE_JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let firebaseKeys;
let firebaseKeysFetchedAt = 0;

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(origin ? corsHeaders(origin) : {})
    }
  });
}

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Authorization,Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function decodePart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function verifyFirebaseToken(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Sign in to Stoic Discipline before connecting Strava.");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Your sign-in token is invalid. Please sign in again.");
  const headerData = decodePart(parts[0]);
  const claims = decodePart(parts[1]);

  if (headerData.alg !== "RS256" || !headerData.kid) throw new Error("Unsupported sign-in token.");
  const projectId = env.FIREBASE_PROJECT_ID || "stoic-discipline";
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` ||
      !claims.sub || claims.sub.length > 128 || claims.exp <= now || claims.iat > now + 60) {
    throw new Error("Your sign-in has expired or is invalid. Please sign in again.");
  }

  if (!firebaseKeys || Date.now() - firebaseKeysFetchedAt > 3600000) {
    const response = await fetch(FIREBASE_JWKS);
    if (!response.ok) throw new Error("Could not verify your Stoic Discipline sign-in.");
    firebaseKeys = await response.json();
    firebaseKeysFetchedAt = Date.now();
  }
  const jwk = firebaseKeys.keys.find(key => key.kid === headerData.kid);
  if (!jwk) {
    firebaseKeysFetchedAt = 0;
    throw new Error("Your sign-in key could not be verified. Please try again.");
  }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!valid) throw new Error("Your sign-in token could not be verified.");
  return claims.sub;
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("origin") || "";
  const appOrigin = env.APP_ORIGIN || "https://joshrpenney.github.io";
  return origin === appOrigin ? origin : "";
}

async function getStravaToken(uid, env) {
  const key = `athlete:${uid}`;
  const saved = await env.STRAVA_TOKENS.get(key, "json");
  if (!saved?.refresh_token) return null;

  if (saved.expires_at > Math.floor(Date.now() / 1000) + 120) return saved;

  const response = await fetch(STRAVA_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: saved.refresh_token
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    await env.STRAVA_TOKENS.delete(key);
    throw new Error("Strava authorisation has expired. Please connect Strava again.");
  }
  const updated = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: data.athlete || saved.athlete,
    connected_at: saved.connected_at
  };
  await env.STRAVA_TOKENS.put(key, JSON.stringify(updated));
  return updated;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      if (url.pathname === "/health") return json({ ok: true, service: "stoic-strava-api" });

      if (url.pathname === "/strava/callback" && request.method === "GET") {
        const state = url.searchParams.get("state") || "";
        const code = url.searchParams.get("code") || "";
        const error = url.searchParams.get("error");
        const stateRecord = state ? await env.STRAVA_TOKENS.get(`state:${state}`, "json") : null;
        if (!stateRecord || stateRecord.expiresAt < Date.now()) {
          return new Response("This Strava connection request has expired. Return to Stoic Discipline and try again.", { status: 400 });
        }
        await env.STRAVA_TOKENS.delete(`state:${state}`);
        const appUrl = new URL(env.APP_URL || "https://joshrpenney.github.io/stoic-discipline/");
        if (error || !code) {
          appUrl.searchParams.set("strava", "denied");
          return Response.redirect(appUrl.toString(), 302);
        }

        const tokenResponse = await fetch(STRAVA_TOKEN, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.STRAVA_CLIENT_ID,
            client_secret: env.STRAVA_CLIENT_SECRET,
            code,
            grant_type: "authorization_code"
          })
        });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.access_token || !tokenData.refresh_token) {
          appUrl.searchParams.set("strava", "error");
          return Response.redirect(appUrl.toString(), 302);
        }
        await env.STRAVA_TOKENS.put(`athlete:${stateRecord.uid}`, JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: tokenData.expires_at,
          athlete: tokenData.athlete || null,
          connected_at: new Date().toISOString()
        }));
        appUrl.searchParams.set("strava", "connected");
        return Response.redirect(appUrl.toString(), 302);
      }

      if (!["GET", "POST"].includes(request.method)) return json({ error: "Method not allowed." }, 405, origin);
      if (!origin) return json({ error: "This app origin is not allowed." }, 403);
      const uid = await verifyFirebaseToken(request, env);

      if (url.pathname === "/strava/connect" && request.method === "GET") {
        const stateBytes = crypto.getRandomValues(new Uint8Array(32));
        const state = Array.from(stateBytes, byte => byte.toString(16).padStart(2, "0")).join("");
        await env.STRAVA_TOKENS.put(`state:${state}`, JSON.stringify({ uid, expiresAt: Date.now() + 600000 }), { expirationTtl: 600 });
        const authorize = new URL(STRAVA_AUTHORIZE);
        authorize.search = new URLSearchParams({
          client_id: env.STRAVA_CLIENT_ID,
          response_type: "code",
          redirect_uri: REDIRECT_URI,
          approval_prompt: "auto",
          scope: "read,activity:read_all",
          state
        }).toString();
        return json({ url: authorize.toString() }, 200, origin);
      }

      if (url.pathname === "/strava/status" && request.method === "GET") {
        const saved = await env.STRAVA_TOKENS.get(`athlete:${uid}`, "json");
        return json({
          connected: !!saved?.refresh_token,
          athlete: saved?.athlete ? {
            id: saved.athlete.id,
            firstname: saved.athlete.firstname,
            lastname: saved.athlete.lastname
          } : null
        }, 200, origin);
      }

      if (url.pathname.startsWith("/strava/activities/") && request.method === "GET") {
        const saved = await getStravaToken(uid, env);
        if (!saved) return json({ error: "Connect your Strava account first." }, 404, origin);
        const activityId = url.pathname.split("/").pop();
        if (!/^\\d+$/.test(activityId)) return json({ error: "Invalid activity ID." }, 400, origin);
        const response = await fetch(`${STRAVA_API}/activities/${activityId}?include_all_efforts=true`, {
          headers: { authorization: `Bearer ${saved.access_token}` }
        });
        const data = await response.json();
        if (!response.ok) return json({ error: data.message || "Strava could not return this activity's best efforts." }, response.status, origin);
        return json({
          id: data.id,
          name: data.name,
          sportType: data.sport_type || data.type,
          startDate: data.start_date,
          distance: data.distance,
          movingTime: data.moving_time,
          elapsedTime: data.elapsed_time,
          totalElevationGain: data.total_elevation_gain,
          averageHeartrate: data.average_heartrate ?? null,
          maxHeartrate: data.max_heartrate ?? null,
          bestEfforts: Array.isArray(data.best_efforts) ? data.best_efforts.map(effort => ({
            name: effort.name,
            distance: effort.distance,
            elapsedTime: effort.elapsed_time,
            movingTime: effort.moving_time,
            startDate: effort.start_date,
            prRank: effort.pr_rank ?? null
          })) : []
        }, 200, origin);
      }

      if (url.pathname === "/strava/activities" && request.method === "GET") {
        const saved = await getStravaToken(uid, env);
        if (!saved) return json({ error: "Connect your Strava account first." }, 404, origin);
        const after = Math.max(0, Number(url.searchParams.get("after")) || 0);
        const page = Math.max(1, Math.min(100, Number(url.searchParams.get("page")) || 1));
        const response = await fetch(`${STRAVA_API}/athlete/activities?${new URLSearchParams({ after: String(after), page: String(page), per_page: "100" })}`, {
          headers: { authorization: `Bearer ${saved.access_token}` }
        });
        const data = await response.json();
        if (!response.ok) return json({ error: data.message || "Strava could not return your activities." }, response.status, origin);
        const activities = Array.isArray(data) ? data.filter(item => ["Run", "TrailRun", "VirtualRun"].includes(item.sport_type || item.type)).map(item => ({
          id: item.id,
          name: item.name,
          sportType: item.sport_type || item.type,
          startDate: item.start_date,
          startDateLocal: item.start_date_local,
          distance: item.distance,
          movingTime: item.moving_time,
          elapsedTime: item.elapsed_time,
          totalElevationGain: item.total_elevation_gain,
          averageSpeed: item.average_speed,
          maxSpeed: item.max_speed,
          averageHeartrate: item.average_heartrate ?? null,
          maxHeartrate: item.max_heartrate ?? null,
          averageCadence: item.average_cadence ?? null,
          sufferScore: item.suffer_score ?? null,
          hasHeartrate: item.has_heartrate ?? false,
          workoutType: item.workout_type ?? null
        })) : [];
        return json({ activities, page, hasMore: Array.isArray(data) && data.length === 100 }, 200, origin);
      }

      if (url.pathname === "/strava/disconnect" && request.method === "POST") {
        await env.STRAVA_TOKENS.delete(`athlete:${uid}`);
        return json({ connected: false }, 200, origin);
      }

      return json({ error: "Not found." }, 404, origin);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      return json({ error: message }, 400, origin);
    }
  }
};
