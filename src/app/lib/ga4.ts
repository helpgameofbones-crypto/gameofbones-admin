// Google Analytics 4 (GA4) Data API helper
// Docs: https://developers.google.com/analytics/devguides/reporting/data/v1
//
// Requires three env vars (set in Vercel Project Settings -> Environment Variables,
// NOT in NEXT_PUBLIC_* since these must stay server-side only):
//
//   GA_PROPERTY_ID   - numeric GA4 property id, e.g. 540471303 (found in GA Admin -> Property Settings)
//   GA_CLIENT_EMAIL  - service account email, e.g. gob-analytics@my-project.iam.gserviceaccount.com
//   GA_PRIVATE_KEY   - service account private key (paste the full PEM including
//                      "-----BEGIN PRIVATE KEY-----" ... "-----END PRIVATE KEY-----\n")
//
// Setup steps (one-time, needs Google Cloud Console access):
//   1. console.cloud.google.com -> select/create a project -> enable "Google Analytics Data API"
//   2. IAM & Admin -> Service Accounts -> Create service account -> Create key (JSON) -> download it
//   3. In Google Analytics (analytics.google.com) -> Admin -> Property Access Management ->
//      add the service account's email as a "Viewer" on the "Game Of Bones" property (540471303)
//   4. Copy client_email and private_key from the downloaded JSON into Vercel env vars above
//   5. Redeploy

import { JWT } from 'google-auth-library'

const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']

function getClient() {
  const email = process.env.GA_CLIENT_EMAIL
  const key = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const propertyId = process.env.GA_PROPERTY_ID

  if (!email || !key || !propertyId) {
    throw new Error(
      'Google Analytics is not configured. Set GA_PROPERTY_ID, GA_CLIENT_EMAIL and GA_PRIVATE_KEY in your environment.'
    )
  }

  const jwt = new JWT({ email, key, scopes: SCOPES })
  return { jwt, propertyId }
}

export async function runGA4Report(body: Record<string, any>) {
  const { jwt, propertyId } = getClient()
  const { token } = await jwt.authorize().then(() => jwt.getAccessToken())

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || 'GA4 API request failed')
  }
  return data
}
