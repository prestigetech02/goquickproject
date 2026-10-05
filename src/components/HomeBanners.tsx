import { useCallback, useEffect, useRef, useState } from "react";
import { isTappable, markPopupShown, pickDuePopup, type AppBanner } from "../lib/bannersApi";
import { useBannersQuery } from "../lib/queries";

const SLIDE_EVERY_MS = 5000;
const POPUP_DELAY_MS = 800;

/** Home-screen banner carousel plus the "on open" popup, both managed from the admin. */
export function HomeBanners({ onOpen }: { onOpen: (banner: AppBanner) => void }) {
  const { data, isSuccess } = useBannersQuery();
  const inline = (data ?? []).filter((b) => b.display !== "popup");
  const [popup, setPopup] = useState<AppBanner | null>(null);
  const closePopup = useCallback(() => setPopup(null), []);

  useEffect(() => {
    if (!isSuccess) return;
    const due = pickDuePopup(data.filter((b) => b.display === "popup"));
    if (!due) return;
    let cancelled = false;
    let timer: number | undefined;
    // Wait for the image so the overlay never opens blank; skip it if the image fails.
    const preload = new Image();
    preload.onload = () => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        markPopupShown(due, data.map((b) => b.id));
        setPopup(due);
      }, POPUP_DELAY_MS);
    };
    preload.src = due.image_url;
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isSuccess, data]);

  return (
    <>
      {inline.length > 0 ? <BannerCarousel banners={inline} onOpen={onOpen} /> : null}
      {popup ? (
        <BannerPopup
          banner={popup}
          onClose={closePopup}
          onOpen={(banner) => {
            setPopup(null);
            onOpen(banner);
          }}
        />
      ) : null}
    </>
  );
}

function BannerCarousel({ banners, onOpen }: { banners: AppBanner[]; onOpen: (banner: AppBanner) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = Math.min(index, banners.length - 1);

  useEffect(() => {
    if (banners.length < 2 || paused) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % banners.length), SLIDE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [banners.length, paused]);

  return (
    <section className="home-banners" aria-label="Announcements">
      <div
        className="home-banners-viewport"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="home-banners-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {banners.map((banner, i) => {
            const image = <img src={banner.image_url} alt={banner.title} loading="lazy" decoding="async" />;
            return (
              <div key={banner.id} className="home-banners-slide" aria-hidden={i !== current}>
                {isTappable(banner) ? (
                  <button type="button" tabIndex={i === current ? 0 : -1} onClick={() => onOpen(banner)}>
                    {image}
                  </button>
                ) : (
                  image
                )}
              </div>
            );
          })}
        </div>
      </div>

      {banners.length > 1 ? (
        <div className="home-banners-dots">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              className={i === current ? "is-active" : undefined}
              onClick={() => setIndex(i)}
              aria-label={`Show banner ${i + 1} of ${banners.length}`}
              aria-current={i === current}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BannerPopup({
  banner,
  onClose,
  onOpen,
}: {
  banner: AppBanner;
  onClose: () => void;
  onOpen: (banner: AppBanner) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const image = <img src={banner.image_url} alt={banner.title} />;

  return (
    <div
      className="banner-popup-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={banner.title || "Announcement"}
      onClick={onClose}
    >
      <div className="banner-popup-card" onClick={(event) => event.stopPropagation()}>
        {isTappable(banner) ? (
          <button type="button" onClick={() => onOpen(banner)}>
            {image}
          </button>
        ) : (
          image
        )}
      </div>
      <button ref={closeRef} type="button" className="banner-popup-close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
