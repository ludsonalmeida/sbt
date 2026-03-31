import { useState } from 'react'
import type { PlaceData, EnrichedData } from '../services/chatService'

interface Props {
  place: PlaceData
  loading?: boolean
}

// ── URLs de navegação ─────────────────────────────────
function buildNavUrls(nome: string, e?: EnrichedData) {
  const label = encodeURIComponent(`${nome} Sobradinho DF`)

  // Extrai place_id do mapsUrl do Apify: ?query_place_id=ChIJ...
  let placeId: string | null = null
  if (e?.mapsUrl) {
    try { placeId = new URL(e.mapsUrl).searchParams.get('query_place_id') } catch {}
  }

  const gMaps = e?.lat && e?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}${placeId ? `&destination_place_id=${placeId}` : ''}`
    : placeId
      ? `https://www.google.com/maps/dir/?api=1&destination=${label}&destination_place_id=${placeId}`
      : `https://www.google.com/maps/dir/?api=1&destination=${label}`

  const waze = e?.lat && e?.lng
    ? `https://waze.com/ul?ll=${e.lat},${e.lng}&navigate=yes`
    : `https://waze.com/ul?q=${label}&navigate=yes`

  return { gMaps, waze }
}

// ── Stars ─────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 20 20"
          fill={i < full ? '#F5A623' : i === full && half ? 'url(#half)' : '#E8E2D8'}>
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="#F5A623"/>
              <stop offset="50%" stopColor="#E8E2D8"/>
            </linearGradient>
          </defs>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </span>
  )
}

// ── Nav buttons ───────────────────────────────────────
function NavButtons({ nome, enriched: e }: { nome: string; enriched?: EnrichedData }) {
  if (!e?.lat && !e?.mapsUrl) return null
  const { gMaps, waze } = buildNavUrls(nome, e)
  return (
    <div className="flex gap-2">
      <a href={gMaps} target="_blank" rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                   bg-[#4285F4] text-white text-xs font-semibold hover:bg-[#3367D6] transition-colors">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        Ir de Maps
      </a>
      <a href={waze} target="_blank" rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                   bg-[#05C8F7] text-white text-xs font-semibold hover:bg-[#00B4DC] transition-colors">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        Ir de Waze
      </a>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────
function EnrichSkeleton() {
  return (
    <div className="animate-pulse space-y-2 mt-3">
      <div className="h-3 bg-areia rounded w-2/3"/>
      <div className="h-3 bg-areia rounded w-1/2"/>
    </div>
  )
}

// ── PlaceCard ─────────────────────────────────────────
export function PlaceCard({ place, loading = false }: Props) {
  const e = place.enriched
  const [imgError, setImgError] = useState(false)
  const mapsUrl = e?.mapsUrl ??
    `https://www.google.com/maps/search/${encodeURIComponent(place.nome + ' ' + (place.cidade ?? 'Sobradinho DF'))}`

  const showPhoto = e?.photo && !imgError

  return (
    <div className="bg-white rounded-2xl border border-borda/60 overflow-hidden
                    hover:shadow-card-hover transition-shadow group"
         style={{ boxShadow: '0 2px 12px rgba(26,26,24,0.08)' }}>

      {/* Foto do lugar */}
      {showPhoto && (
        <div className="h-36 overflow-hidden bg-areia">
          <img
            src={e!.photo}
            alt={place.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Accent bar (só sem foto) */}
      {!showPhoto && <div className="h-1 bg-sol w-full" />}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl bg-laranja-claro flex items-center justify-center flex-shrink-0 text-xl ${e?.photo ? 'mt-0' : ''}`}>
            {place.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-head font-bold text-base leading-tight text-[#1A1A18]">
              {place.nome}
            </h3>
            <span className="inline-flex items-center text-xs bg-areia text-muted font-semibold
                             px-2 py-0.5 rounded-full mt-0.5">
              {place.categoria}
            </span>
          </div>

          {/* Rating badge */}
          {e?.rating && (
            <div className="flex-shrink-0 text-right">
              <div className="flex items-center gap-1">
                <Stars rating={e.rating} />
                <span className="text-xs font-bold text-[#1A1A18]">{e.rating.toFixed(1)}</span>
              </div>
              {e.reviewCount && (
                <p className="text-[10px] text-muted text-right">{e.reviewCount.toLocaleString('pt-BR')} avaliações</p>
              )}
            </div>
          )}
        </div>

        {/* Why */}
        {place.why && (
          <p className="text-sm text-muted mt-3 leading-relaxed border-l-2 border-sol pl-3">
            {place.why}
          </p>
        )}

        {/* Descrição do Google */}
        {e?.description && !place.why && (
          <p className="text-sm text-muted mt-3 leading-relaxed border-l-2 border-sol pl-3">
            {e.description.slice(0, 180)}
          </p>
        )}

        {/* Preço do Google */}
        {e?.price && (
          <span className="inline-flex text-xs font-semibold text-muted bg-areia px-2.5 py-1 rounded-full mt-2">
            {e.price}
          </span>
        )}

        {/* Enrichment loading */}
        {loading && <EnrichSkeleton />}

        {/* Enriched meta */}
        {e && (
          <div className="mt-3 space-y-2">
            {/* Horário e status */}
            {(e.hoursToday || place.horario) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-muted bg-areia px-2.5 py-1 rounded-full">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 2"/>
                  </svg>
                  {e.hoursToday ?? place.horario}
                </span>
                {e.temporarilyClosed && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                    Temporariamente fechado
                  </span>
                )}
                {!e.temporarilyClosed && e.openNow !== undefined && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    e.openNow ? 'bg-verde-claro text-cerrado' : 'bg-red-50 text-red-500'
                  }`}>
                    {e.openNow ? 'Aberto agora' : 'Fechado agora'}
                  </span>
                )}
              </div>
            )}

            {/* Endereço */}
            {e.address && (
              <p className="text-xs text-muted flex items-start gap-1.5">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="flex-shrink-0 mt-0.5">
                  <path d="M8 14s-5-4.5-5-8a5 5 0 0 1 10 0c0 3.5-5 8-5 8z"/><circle cx="8" cy="6" r="1.5"/>
                </svg>
                {e.address}
              </p>
            )}

            {/* Telefone / Website */}
            {(e.phone || e.website) && (
              <div className="flex flex-wrap gap-2">
                {e.phone && (
                  <a href={`tel:${e.phone}`}
                    className="text-xs text-muted flex items-center gap-1 hover:text-cerrado transition-colors">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2 3a1 1 0 0 1 1-1h2.153a1 1 0 0 1 .986.836l.74 4.435a1 1 0 0 1-.54 1.06l-1.548.773a11.037 11.037 0 0 0 6.105 6.105l.774-1.548a1 1 0 0 1 1.059-.54l4.435.74a1 1 0 0 1 .836.986V13a2 2 0 0 1-2 2 16 16 0 0 1-16-16 2 2 0 0 1 2-2z"/>
                    </svg>
                    {e.phone}
                  </a>
                )}
                {e.website && (
                  <a href={e.website} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-muted flex items-center gap-1 hover:text-cerrado transition-colors truncate max-w-[160px]">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="8" cy="8" r="6.5"/>
                      <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5M1.5 8h13"/>
                    </svg>
                    {e.website.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                )}
              </div>
            )}

            {/* Top review */}
            {e.topReviews?.[0]?.text && (
              <div className="bg-areia rounded-xl p-3 mt-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Stars rating={e.topReviews[0].rating ?? 5} />
                  <span className="text-[10px] text-muted">{e.topReviews[0].date}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed italic">
                  "{e.topReviews[0].text}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Meta básico (sem enrichment) */}
        {!e && !loading && (place.horario || place.preco || place.distancia) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {place.horario && (
              <span className="flex items-center gap-1 text-xs text-muted bg-areia px-2.5 py-1 rounded-full">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 2"/>
                </svg>
                {place.horario}
              </span>
            )}
            {place.preco && (
              <span className="text-xs text-muted bg-areia px-2.5 py-1 rounded-full">{place.preco}</span>
            )}
            {place.distancia && (
              <span className="flex items-center gap-1 text-xs text-muted bg-areia px-2.5 py-1 rounded-full">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M8 14s-5-4.5-5-8a5 5 0 0 1 10 0c0 3.5-5 8-5 8z"/><circle cx="8" cy="6" r="1.5"/>
                </svg>
                {place.distancia}
              </span>
            )}
          </div>
        )}

        {/* Botões de ação */}
        <div className="mt-4 space-y-2">
          {/* Ver no Maps */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                       border border-borda text-sm font-semibold text-muted
                       hover:border-sol hover:text-[#1A1A18] hover:bg-laranja-claro transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            Ver no Google Maps
          </a>

          {/* Navegação — só aparece quando temos dados do Apify */}
          <NavButtons nome={place.nome} enriched={e} />
        </div>
      </div>
    </div>
  )
}
