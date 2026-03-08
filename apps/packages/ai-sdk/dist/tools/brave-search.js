/**
 * Brave Web Search API client.
 * Docs: https://api.search.brave.com/app#/documentation/web-search
 */
export async function braveSearch(query, numResults, apiKey) {
    const count = numResults ?? 5;
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    const res = await fetch(url, {
        headers: { "X-Subscription-Token": apiKey },
    });
    if (!res.ok)
        return [];
    const data = await res.json();
    return (data.web?.results ?? []).slice(0, numResults).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
    }));
}
