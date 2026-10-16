/**
 * How far the infinite scroll goes before handing back to pagination.
 *
 * 15 chunks of 13 = 195 articles. Shared by the listing page (which tells the
 * scroll where to stop) and the chunk route (which refuses anything past it),
 * so the two cannot disagree about where the boundary is -- a mismatch would
 * show as a scroll that keeps asking for chunks the server answers with 404.
 */
export const NEWS_MAX_CHUNK = 15;
