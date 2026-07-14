import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url || !String(url).includes('zillow.com')) {
    return NextResponse.json({ error: 'Please paste a Zillow listing URL' }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(String(url), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Zillow returned ${res.status}. Try again or enter details manually.` },
        { status: 422 },
      );
    }

    html = await res.text();
  } catch {
    return NextResponse.json(
      { error: 'Could not reach Zillow. Check the URL and try again.' },
      { status: 422 },
    );
  }

  // Extract embedded JSON from __NEXT_DATA__ script tag
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
  if (!match) {
    return NextResponse.json(
      { error: 'Could not parse Zillow page — Zillow may have blocked the request. Enter details manually.' },
      { status: 422 },
    );
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return NextResponse.json({ error: 'Failed to parse Zillow data.' }, { status: 422 });
  }

  // Zillow nests property data inside gdpClientCache keyed by URL
  const gdpCache = (data as any)?.props?.pageProps?.gdpClientCache;
  let property: Record<string, any> | null = null;

  if (gdpCache && typeof gdpCache === 'object') {
    for (const key of Object.keys(gdpCache)) {
      const candidate = gdpCache[key]?.property;
      if (candidate && (candidate.price || candidate.bedrooms || candidate.livingArea)) {
        property = candidate;
        break;
      }
    }
  }

  // Fallback: some pages put it directly in componentProps
  if (!property) {
    const cp = (data as any)?.props?.pageProps?.componentProps;
    if (cp?.gdpClientCache) {
      for (const key of Object.keys(cp.gdpClientCache)) {
        const candidate = cp.gdpClientCache[key]?.property;
        if (candidate) { property = candidate; break; }
      }
    }
  }

  if (!property) {
    return NextResponse.json(
      { error: 'Could not find property details in the Zillow page. Enter details manually.' },
      { status: 422 },
    );
  }

  return NextResponse.json({
    address: property.address?.streetAddress || '',
    city: property.address?.city || '',
    price: property.price ?? property.listPrice ?? null,
    beds: property.bedrooms ?? null,
    baths: property.bathrooms ?? property.bathroomsFloat ?? null,
    sqft: property.livingArea ?? null,
    description: property.description ?? null,
  });
}
