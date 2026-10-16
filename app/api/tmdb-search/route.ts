import { NextRequest, NextResponse } from "next/server";

// TMDB proxy: looks up a film by title (+ optional year) and returns poster path
// and a clean title. Keeps the API key server-side and lets the client send a
// batch of titles to resolve in one round-trip.

type TmdbSearchResult = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
};

type TmdbSearchResponse = {
  results?: TmdbSearchResult[];
};

type Query = { title: string; year?: number };
type ResolvedFilm = {
  query: string;
  tmdb_id: number | null;
  title: string | null;
  year: number | null;
  poster_url: string | null;
};

export async function POST(request: NextRequest) {
  let queries: Query[];
  let clientKey: string | undefined;
  try {
    const body = await request.json();
    queries = Array.isArray(body.queries) ? body.queries : [];
    clientKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = (clientKey && clientKey.trim()) || process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY not configured" }, { status: 500 });
  }

  const resolved: ResolvedFilm[] = await Promise.all(
    queries.map(async (q): Promise<ResolvedFilm> => {
      const title = (q.title || "").trim();
      if (!title) {
        return { query: title, tmdb_id: null, title: null, year: null, poster_url: null };
      }

      const params = new URLSearchParams({
        api_key: apiKey,
        query: title,
        include_adult: "false",
        language: "en-US",
      });
      if (q.year) params.set("year", String(q.year));

      try {
        const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`, {
          next: { revalidate: 86400 },
        });
        if (!res.ok) throw new Error(`TMDB ${res.status}`);
        const data = (await res.json()) as TmdbSearchResponse;
        const hit = data.results?.[0];
        if (!hit) {
          return { query: title, tmdb_id: null, title: null, year: null, poster_url: null };
        }
        return {
          query: title,
          tmdb_id: hit.id,
          title: hit.title,
          year: hit.release_date ? Number(hit.release_date.slice(0, 4)) : null,
          poster_url: hit.poster_path
            ? `https://image.tmdb.org/t/p/w342${hit.poster_path}`
            : null,
        };
      } catch {
        return { query: title, tmdb_id: null, title: null, year: null, poster_url: null };
      }
    }),
  );

  return NextResponse.json({ films: resolved });
}
