export function createTwilioClient(
  credential: { account_sid: string; auth_token: string },
  _options: Record<string, unknown>,
) {
  const { account_sid, auth_token } = credential;
  const authHeader = "Basic " + Buffer.from(`${account_sid}:${auth_token}`).toString("base64");

  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}`;

  async function post(url: string, params: Record<string, string>) {
    const body = new URLSearchParams(params);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new Error(JSON.stringify(err));
    }
    return await res.json();
  }

  return {
    async makeCall(params: Record<string, string>) {
      return post(`${baseUrl}/Calls.json`, params);
    },

    async get(path: string) {
      const url = `${baseUrl}${path}`;
      const res = await fetch(url, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(JSON.stringify(err));
      }
      return await res.json();
    },

    async sendSms(params: { to: string; from: string; body: string; mediaUrl?: string }) {
      const formParams: Record<string, string> = {
        To: params.to,
        From: params.from,
        Body: params.body,
      };
      if (params.mediaUrl) formParams.MediaUrl = params.mediaUrl;
      return post(`${baseUrl}/Messages.json`, formParams);
    },

    async updateCall(callSid: string, params: Record<string, string>) {
      return post(`${baseUrl}/Calls/${callSid}.json`, params);
    },

    async close() { /* no persistent connections */ },
  };
}
