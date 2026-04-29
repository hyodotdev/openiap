import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  title?: string;
}

export function GuideModal({
  isOpen,
  onClose,
  images,
  title,
}: GuideModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
      return;
    }

    // Snapshot + restore the prior overflow value instead of forcing it
    // back to "" — other scroll-lock managers (nested modals, etc.)
    // may already be managing body overflow.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      }
      if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, currentIndex, images.length]);

  if (!isOpen || !images.length) return null;

  const currentImage = images[currentIndex];
  const showPrev = currentIndex > 0;
  const showNext = currentIndex < images.length - 1;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-[9999] overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 pointer-events-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title || "Guide"}
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label={"Close"}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X
                  className="w-5 h-5 text-gray-600 dark:text-gray-400"
                  aria-hidden="true"
                />
              </button>
            </div>

            <div className="relative p-6 bg-gray-50 dark:bg-gray-800">
              <img
                src={currentImage.src}
                alt={currentImage.alt}
                className="w-full rounded-lg shadow-md"
              />

              {currentImage.caption && (
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
                  {currentImage.caption}
                </p>
              )}

              {images.length > 1 && (
                <>
                  {showPrev && (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => prev - 1)}
                      aria-label={"Previous slide"}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full shadow-lg transition-all"
                    >
                      <ChevronLeft
                        className="w-5 h-5 text-gray-700 dark:text-gray-300"
                        aria-hidden="true"
                      />
                    </button>
                  )}

                  {showNext && (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => prev + 1)}
                      aria-label={"Next slide"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full shadow-lg transition-all"
                    >
                      <ChevronRight
                        className="w-5 h-5 text-gray-700 dark:text-gray-300"
                        aria-hidden="true"
                      />
                    </button>
                  )}

                  <div className="flex justify-center gap-2 mt-4">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCurrentIndex(index)}
                        aria-label={`Go to slide ${index + 1} of ${images.length}`}
                        aria-current={
                          index === currentIndex ? "true" : undefined
                        }
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentIndex
                            ? "bg-blue-500 w-6"
                            : "bg-gray-400 hover:bg-gray-500"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {images.length > 1 && `${currentIndex + 1} / ${images.length}`}
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
              >
                {"Close"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
