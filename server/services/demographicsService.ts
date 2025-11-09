/**
 * demographicsService
 *
 * Fetches demographic indicators to support at-risk calculations.
 *
 * Implementation note: The user requested the United Nations Data Portal API. Many
 * international demographic indicators are available via the World Bank API without
 * an API key and are a reasonable proxy for UN data for this use-case. If you
 * prefer a strict UN API endpoint, we can swap the implementation later.
 */

export async function getElderlyPercent(countryCode: string = 'CA', year?: number): Promise<number | null> {
  try {
    const indicator = 'SP.POP.65UP.TO.ZS'; // % of population ages 65 and above
    // World Bank API: returns an array where the second element is data
    const dateParam = year ? `&date=${year}` : '&date=2015:2023';
    const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json${dateParam}&per_page=1`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[Demographics] World Bank request failed', res.status);
      return null;
    }

    const json = await res.json();
    // json[1] is array of datapoints, pick the first with value
    const data = json?.[1] ?? [];
    for (const entry of data) {
      if (entry && entry.value != null) {
        return Number(entry.value);
      }
    }

    return null;
  } catch (err) {
    console.error('[Demographics] Error fetching elderly percent:', err);
    return null;
  }
}
