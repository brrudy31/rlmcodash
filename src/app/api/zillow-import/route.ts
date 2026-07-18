import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ── prospects.com parser ──────────────────────────────────────────────────────
function parseProspects(html: string) {
  // Address + city from og:title: "Listing in Bensalem PA at 3032 Gilbert Drive"
  const ogTitleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
  let address = '';
  let city = '';
  if (ogTitleMatch) {
    const atMatch = ogTitleMatch[1].match(/Listing in (.+?)\s+[A-Z]{2}(?:,\s*\d{5})?\s+at\s+(.+)/i);
    if (atMatch) { city = atMatch[1].trim(); address = atMatch[2].trim(); }
  }

  // Price: first $NNN,NNN pattern
  const priceMatch = html.match(/\$\s*([\d,]+)/);
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;

  // Beds / baths / sqft from body text patterns
  const bedsMatch = html.match(/BEDROOMS\s*[:\s]+(\d+)/i);
  const beds = bedsMatch ? Number(bedsMatch[1]) : null;

  const bathsMatch = html.match(/BATHROOMS\s*[:\s]+([\d.]+)/i);
  const baths = bathsMatch ? Number(bathsMatch[1]) : null;

  const sqftMatch = html.match(/LIVING AREA\s*[:\s]+([\d,]+)\s*sqft/i);
  const sqft = sqftMatch ? Number(sqftMatch[1].replace(/,/g, '')) : null;

  // Description: text between "Description" heading and next section
  const descStart = html.indexOf('>Description<');
  let description: string | null = null;
  if (descStart !== -1) {
    // Skip past the heading tag
    const afterTag = html.indexOf('>', descStart) + 1;
    // Find next block-level tag after content
    const nextSection = html.indexOf('<div', afterTag);
    const rawDesc = html.slice(afterTag, nextSection > afterTag ? nextSection : afterTag + 3000);
    // Strip HTML tags and decode entities
    description = rawDesc
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 1500) || null;
  }

  return { address, city, price, beds, baths, sqft, description };
}

// ── Zillow parser ─────────────────────────────────────────────────────────────
function parseZillow(html: string) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const startIdx = html.indexOf(marker);
  const endIdx = startIdx !== -1 ? html.indexOf('</script>', startIdx + marker.length) : -1;
  const jsonStr = startIdx !== -1 && endIdx !== -1 ? html.slice(startIdx + marker.length, endIdx) : null;
  if (!jsonStr) return null;

  let data: Record<string, unknown>;
  try { data = JSON.parse(jsonStr); } catch { return null; }

  const gdpCache = (data as any)?.props?.pageProps?.gdpClientCache;
  let property: Record<string, any> | null = null;

  if (gdpCache && typeof gdpCache === 'object') {
    for (const key of Object.keys(gdpCache)) {
      const candidate = gdpCache[key]?.property;
      if (candidate && (candidate.price || candidate.bedrooms || candidate.livingArea)) {
        property = candidate; break;
      }
    }
  }
  if (!property) {
    const cp = (data as any)?.props?.pageProps?.componentProps;
    if (cp?.gdpClientCache) {
      for (const key of Object.keys(cp.gdpClientCache)) {
        const candidate = cp.gdpClientCache[key]?.property;
        if (candidate) { property = candidate; break; }
      }
    }
  }
  if (!property) return null;

  return {
    address: property.address?.streetAddress || '',
    city: property.address?.city || '',
    price: property.price ?? property.listPrice ?? null,
    beds: property.bedrooms ?? null,
    baths: property.bathrooms ?? property.bathroomsFloat ?? null,
    sqft: property.livingArea ?? null,
    description: property.description ?? null,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { url } = await request.json();
  const urlStr = String(url ?? '');

  const isProspects = urlStr.includes('prospects.com');
  const isZillow = urlStr.includes('zillow.com');

  if (!isProspects && !isZillow) {
    return NextResponse.json(
      { error: 'Please paste a Zillow or MLS Prospects listing URL' },
      { status: 400 },
    );
  }

  let html: string;
  try {
    const res = await fetch(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Site returned ${res.status}. Try again or enter details manually.` },
        { status: 422 },
      );
    }
    html = await res.text();
  } catch {
    return NextResponse.json(
      { error: 'Could not reach that URL. Check the link and try again.' },
      { status: 422 },
    );
  }

  const result = isProspects ? parseProspects(html) : parseZillow(html);

  if (!result) {
    return NextResponse.json(
      { error: 'Could not parse property details from this page. Enter details manually.' },
      { status: 422 },
    );
  }

  return NextResponse.json(result);
}
