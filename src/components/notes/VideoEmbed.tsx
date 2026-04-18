import { vimeoVideoId, youtubeVideoId } from '../../lib/noteMedia'

export function VideoEmbed({ url }: { url: string }) {
  const u = url.trim()
  if (!u) return null
  const yt = youtubeVideoId(u)
  if (yt) {
    return (
      <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-[3px] border border-[rgba(10,10,10,0.2)] bg-ink/[0.03]">
        <iframe
          title="Встроенное видео"
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${yt}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    )
  }
  const vm = vimeoVideoId(u)
  if (vm) {
    return (
      <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-[3px] border border-[rgba(10,10,10,0.2)] bg-ink/[0.03]">
        <iframe
          title="Встроенное видео"
          className="h-full w-full"
          src={`https://player.vimeo.com/video/${vm}`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  return (
    <video
      className="max-h-[min(70vh,480px)] w-full rounded-[3px] border border-[rgba(10,10,10,0.2)] bg-ink/[0.04]"
      src={u}
      controls
      playsInline
      preload="metadata"
    />
  )
}
