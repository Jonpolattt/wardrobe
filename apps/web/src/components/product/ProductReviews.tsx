'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery } from '@apollo/client';
import { Star, ImagePlus, X, Loader2, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import { GET_REVIEWS, CAN_REVIEW_PRODUCT } from '@/lib/graphql/queries';
import { CREATE_REVIEW, DELETE_REVIEW } from '@/lib/graphql/mutations';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatDate } from '@/lib/utils/format';
import { useScrollLock } from '@/lib/hooks/use-scroll-lock';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  // Yellow (amber-400), per request — a star rating reads by convention
  // regardless of the site's own green accent, same choice already made
  // for ProductCard's rating stars.
  return (
    <div className="flex gap-0.5 text-amber-400">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= value ? 'currentColor' : 'none'}
          className={n <= value ? '' : 'text-ink-900/20 dark:text-cream/20'}
        />
      ))}
    </div>
  );
}

// One review card — name + date on the left, stars (and the admin delete
// button) on the right, comment below, then a row for the attached photo.
// Shared by both the paged carousel and the "all reviews" grid so the two
// stay visually identical.
function ReviewCard({
  review,
  locale,
  isAdmin,
  onDelete,
  deletingId,
  deleteLabel,
  onImageClick,
}: {
  review: any;
  locale: Locale;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  deletingId: string | null;
  deleteLabel: string;
  onImageClick: (src: string) => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-ink-900/8 bg-white/40 p-5 shadow-soft dark:border-cream/8 dark:bg-cream/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-950 dark:text-cream">
            {review.user?.firstName} {review.user?.lastName ?? ''}
          </p>
          <p className="mt-0.5 text-xs text-ink-900/40 dark:text-cream/40">{formatDate(review.createdAt, locale)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Stars value={review.rating} size={13} />
          {isAdmin && (
            <button
              type="button"
              onClick={() => onDelete(review.id)}
              disabled={deletingId === review.id}
              aria-label={deleteLabel}
              title={deleteLabel}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-900/30 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:text-cream/30 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              {deletingId === review.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-900/70 dark:text-cream/70">{review.comment}</p>
      {review.image && (
        // Small, fixed-size thumbnail (not flex-1 — that was letting this
        // row's presence change the card's overall height a lot more than
        // a photo attachment should) so a card with a photo stays close in
        // height to one without, instead of ballooning.
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onImageClick(review.image)}
            className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-ink-900/10 transition-opacity hover:opacity-90 dark:border-cream/10"
          >
            <Image src={review.image} alt="" fill sizes="44px" className="object-cover" />
          </button>
        </div>
      )}
    </div>
  );
}

export function ProductReviews({ productId, locale, dict }: { productId: string; locale: Locale; dict: Dictionary }) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAdmin = user?.role === 'ADMIN';

  // Polls for new reviews from other users every 30s — a WebSocket-based
  // live-push version was tried first but proved unreliable in practice
  // (dev-mode Windows networking flakiness made the gateway connection drop
  // silently); plain polling is simpler and reliable. The current user's
  // own new review still appears instantly regardless — see the
  // mutation's `update` below.
  //
  // fetchPolicy MUST be 'cache-and-network', not the Apollo default of
  // 'cache-first'. With cache-first, leaving the product page and coming
  // back (e.g. going to another product, then back — a normal client-side
  // navigation, not a full page reload) remounts this component, and
  // Apollo just replays whatever reviews list it already had cached for
  // this productId instead of asking the backend again — so a review
  // someone else left while you were away stays invisible until a full
  // browser refresh wipes the in-memory cache. cache-and-network shows the
  // cached list instantly (no blank flash) but ALSO fires a real network
  // request on every mount, so navigating back to a product always picks
  // up whatever's actually new.
  const { data, loading } = useQuery(GET_REVIEWS, {
    variables: { productId },
    pollInterval: 30_000,
    fetchPolicy: 'cache-and-network',
  });

  // Only a real buyer of this product (or an admin) may write a review —
  // the backend enforces this for real (review.service.ts rejects the
  // mutation outright), this query just lets the UI show the right prompt
  // instead of a form that would fail on submit. Skipped entirely for
  // admins (always eligible) and guests (handled by the loginPrompt branch
  // below).
  const { data: canReviewData, loading: canReviewLoading } = useQuery(CAN_REVIEW_PRODUCT, {
    variables: { productId },
    skip: !user || isAdmin,
    fetchPolicy: 'cache-and-network',
  });
  const canReview = isAdmin || canReviewData?.canReviewProduct === true;
  // True only while we're still waiting on that very first eligibility
  // answer — avoids flashing "you must purchase this first" for a moment
  // before flipping to the real form.
  const canReviewPending = !!user && !isAdmin && canReviewLoading && canReviewData === undefined;

  // Writing the new review into the cache directly (instead of waiting for
  // the next poll) makes the submitter's own review show up immediately.
  const [createReview, { loading: submitting }] = useMutation(CREATE_REVIEW, {
    update(cache, { data: mutationData }) {
      const newReview = mutationData?.createReview;
      if (!newReview) return;

      const existing = cache.readQuery<{ reviews: any[] }>({ query: GET_REVIEWS, variables: { productId } });
      cache.writeQuery({
        query: GET_REVIEWS,
        variables: { productId },
        data: { reviews: [newReview, ...(existing?.reviews ?? [])] },
      });
    },
  });

  // Lets an admin remove any review right from the product page itself
  // (instead of having to go find it in a separate admin dashboard). The
  // backend already rejects this mutation for non-admins regardless of
  // what the frontend shows (@Roles(Role.ADMIN) in review.resolver.ts) —
  // hiding the button for everyone else here is just UX polish on top of
  // that real, server-side restriction.
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [deleteReview] = useMutation(DELETE_REVIEW, {
    update(cache, _result, { variables }) {
      const existing = cache.readQuery<{ reviews: any[] }>({ query: GET_REVIEWS, variables: { productId } });
      if (!existing) return;
      cache.writeQuery({
        query: GET_REVIEWS,
        variables: { productId },
        data: { reviews: existing.reviews.filter((r) => r.id !== variables?.id) },
      });
    },
  });

  async function handleDeleteReview(reviewId: string) {
    if (!window.confirm(dict.reviewsSection.deleteConfirm)) return;
    setDeletingReviewId(reviewId);
    try {
      await deleteReview({ variables: { id: reviewId } });
    } catch {
      // Swallowed on purpose — if it fails (e.g. connection hiccup), the
      // review simply stays in the list, which is a safe/obvious enough
      // signal that nothing happened without needing a separate toast.
    } finally {
      setDeletingReviewId(null);
    }
  }

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [image, setImage] = useState<string | null>(null);
  // Instant local preview (object URL) shown the moment a file is picked,
  // before the upload round-trip finishes — so the user sees "qanaqaligi"
  // (what it looks like) right away instead of staring at a blank slot.
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const reviews = data?.reviews ?? [];
  const avgRating = reviews.length
    ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
    : 0;

  // Carousel paging: 2 cards per page on wider screens, 1 on mobile — the
  // page COUNT itself needs to change (not just CSS columns), so this
  // tracks viewport width directly rather than relying on a Tailwind
  // breakpoint alone.
  const [perPage, setPerPage] = useState(2);
  useEffect(() => {
    function updatePerPage() {
      setPerPage(window.innerWidth < 640 ? 1 : 2);
    }
    updatePerPage();
    window.addEventListener('resize', updatePerPage);
    return () => window.removeEventListener('resize', updatePerPage);
  }, []);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(reviews.length / perPage));
  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [totalPages, page]);
  const pageReviews = reviews.slice(page * perPage, page * perPage + perPage);
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  // ESC closes the "all reviews" modal, matching every other modal in the app.
  useEffect(() => {
    if (!showAllReviews) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowAllReviews(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAllReviews]);

  // Background scroll is locked while either overlay is open — the two are
  // independent calls (not one combined boolean) because they can be open
  // at once: the lightbox can be opened by clicking a photo from inside the
  // "all reviews" grid. useScrollLock reference-counts internally, so
  // closing one while the other is still open correctly leaves the page
  // locked until both are closed.
  useScrollLock(showAllReviews);
  useScrollLock(!!lightbox);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/upload/review-image', {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setImage(url);
    } catch {
      // Failed upload isn't fatal — the review can still be submitted
      // without a photo — but clear the dead preview so nothing looks stuck.
      setImagePreview(null);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function removePhoto() {
    setImage(null);
    setImagePreview(null);
  }

  async function handleSubmit() {
    if (!comment.trim()) return;
    setStatus('idle');
    try {
      await createReview({ variables: { input: { productId, rating, comment: comment.trim(), image: image ?? undefined } } });
      setComment('');
      setImage(null);
      setImagePreview(null);
      setRating(5);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 4000);
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <section className="mt-16 border-t border-ink-900/10 pt-10 dark:border-cream/10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="section-title">{dict.reviewsSection.title}</h2>

          {reviews.length > 0 && (
            <div className="flex items-center gap-3 rounded-2xl bg-ink-900/[0.03] px-4 py-2.5 dark:bg-cream/5">
              <span className="font-display text-2xl font-bold text-ink-950 dark:text-cream">
                {avgRating.toFixed(1)}
              </span>
              <div>
                <Stars value={Math.round(avgRating)} size={13} />
                <p className="mt-0.5 text-xs text-ink-900/50 dark:text-cream/50">
                  {reviews.length} {dict.product.reviews}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-3">
          {!user && (
            <div className="flex items-center justify-between gap-3 rounded-3xl border border-ink-900/8 bg-white/60 p-6 text-sm shadow-soft dark:border-cream/8 dark:bg-cream/[0.03]">
              <span className="text-ink-900/60 dark:text-cream/60">{dict.reviewsSection.loginPrompt}</span>
              <Link href={`/${locale}/login`} className="btn-outline !px-4 !py-2 text-xs">
                {dict.reviewsSection.loginLink}
              </Link>
            </div>
          )}

          {/* Logged in, but hasn't bought this product (and isn't admin) —
              the write-review form is replaced with this notice instead of
              being hidden without explanation. The backend rejects the
              mutation outright either way, so this is purely informational,
              not the actual security boundary. */}
          {user && !canReviewPending && !canReview && (
            <div className="rounded-3xl border border-ink-900/8 bg-white/60 p-6 text-sm text-ink-900/60 shadow-soft dark:border-cream/8 dark:bg-cream/[0.03] dark:text-cream/60">
              {dict.reviewsSection.purchaseRequired}
            </div>
          )}

          {user && !canReviewPending && canReview && (
            <div className="space-y-4 rounded-3xl border border-ink-900/8 bg-white/60 p-6 shadow-soft dark:border-cream/8 dark:bg-cream/[0.03]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">
                {dict.reviewsSection.writeTitle}
              </h3>

              <div>
                <p className="mb-2 text-xs font-semibold text-ink-900/60 dark:text-cream/60">
                  {dict.reviewsSection.yourRating}
                </p>
                <div className="flex gap-1.5" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHoverRating(n)}
                      onClick={() => setRating(n)}
                      className="text-amber-400 transition-transform hover:scale-110"
                    >
                      <Star
                        size={26}
                        fill={n <= (hoverRating || rating) ? 'currentColor' : 'none'}
                        className={n <= (hoverRating || rating) ? '' : 'text-ink-900/15 dark:text-cream/15'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={dict.reviewsSection.commentPlaceholder}
                className="w-full rounded-2xl border border-ink-900/15 px-4 py-3 text-sm text-ink-950 outline-none transition-colors focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream"
              />

              <div>
                <p className="mb-2 text-xs font-semibold text-ink-900/60 dark:text-cream/60">
                  {dict.reviewsSection.addPhoto}
                </p>
                <div className="flex items-center gap-3">
                  {imagePreview || image ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-ink-900/10 dark:border-cream/10">
                      <Image
                        src={(imagePreview ?? image) as string}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Loader2 size={18} className="animate-spin text-white" />
                        </div>
                      )}
                      {!uploading && (
                        <button
                          type="button"
                          onClick={removePhoto}
                          aria-label="Rasmni olib tashlash"
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label
                      htmlFor="review-photo-upload"
                      className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-ink-900/15 text-ink-900/40 transition-colors hover:border-ink-950 hover:text-ink-950 dark:border-cream/15 dark:text-cream/40 dark:hover:border-cream dark:hover:text-cream"
                    >
                      <ImagePlus size={18} />
                      <span className="text-center text-[10px] font-semibold leading-tight">
                        {dict.reviewsSection.addPhoto}
                      </span>
                    </label>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="review-photo-upload"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || uploading || !comment.trim()}
                className="btn-primary !px-5 !py-2.5 text-xs disabled:opacity-50"
              >
                {submitting ? dict.reviewsSection.submitting : dict.reviewsSection.submit}
              </button>

              {status === 'success' && (
                <p className="text-xs font-semibold text-emerald-600">{dict.reviewsSection.submitSuccess}</p>
              )}
              {status === 'error' && (
                <p className="text-xs font-semibold text-red-500">{dict.reviewsSection.submitError}</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-8">
          {!loading && reviews.length === 0 && (
            <p className="text-sm text-ink-900/50 dark:text-cream/50">{dict.reviewsSection.empty}</p>
          )}

          {reviews.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                {totalPages > 1 && (
                  <button
                    type="button"
                    onClick={() => canPrev && setPage((p) => p - 1)}
                    disabled={!canPrev}
                    aria-label="Oldingi izohlar"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-900/15 text-ink-900 transition-colors hover:border-ink-950 disabled:pointer-events-none disabled:opacity-30 dark:border-cream/20 dark:text-cream dark:hover:border-cream sm:h-10 sm:w-10"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}

                <div className="min-w-0 flex-1 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={page}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className="grid grid-cols-1 gap-5 sm:grid-cols-2"
                    >
                      {pageReviews.map((review: any) => (
                        <ReviewCard
                          key={review.id}
                          review={review}
                          locale={locale}
                          isAdmin={isAdmin}
                          onDelete={handleDeleteReview}
                          deletingId={deletingReviewId}
                          deleteLabel={dict.reviewsSection.delete}
                          onImageClick={setLightbox}
                        />
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {totalPages > 1 && (
                  <button
                    type="button"
                    onClick={() => canNext && setPage((p) => p + 1)}
                    disabled={!canNext}
                    aria-label="Keyingi izohlar"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-900/15 text-ink-900 transition-colors hover:border-ink-950 disabled:pointer-events-none disabled:opacity-30 dark:border-cream/20 dark:text-cream dark:hover:border-cream sm:h-10 sm:w-10"
                  >
                    <ArrowRight size={18} />
                  </button>
                )}
              </div>

              <button type="button" onClick={() => setShowAllReviews(true)} className="btn-outline mt-6 w-full">
                {dict.reviewsSection.viewAll}
              </button>
            </>
          )}
        </div>
      </section>

      {showAllReviews && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-8"
          onClick={() => setShowAllReviews(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-ink-900/10 bg-cream p-6 shadow-soft dark:border-cream/10 dark:bg-ink-950 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-display text-xl font-medium text-ink-950 dark:text-cream sm:text-2xl">
                {dict.reviewsSection.title}
              </h3>
              <button
                type="button"
                onClick={() => setShowAllReviews(false)}
                aria-label={dict.reviewsSection.close}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-900/50 transition-colors hover:bg-ink-900/5 dark:text-cream/50 dark:hover:bg-cream/5"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {reviews.map((review: any) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  locale={locale}
                  isAdmin={isAdmin}
                  onDelete={handleDeleteReview}
                  deletingId={deletingReviewId}
                  deleteLabel={dict.reviewsSection.delete}
                  onImageClick={setLightbox}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="relative h-full max-h-[80vh] w-full max-w-lg">
            <Image src={lightbox} alt="" fill className="object-contain" />
          </div>
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Yopish"
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}
