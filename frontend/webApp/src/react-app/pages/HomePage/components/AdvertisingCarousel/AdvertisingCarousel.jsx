import { Children, useEffect, useRef, useState } from 'react';
import './AdvertisingCarousel.css';

export function AdvertisingCarousel({
  children,
  getSlideLabel,
  hidden = false,
  id,
  paginationLabel,
}) {
  const slides = Children.toArray(children);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const sliderRef = useRef(null);

  useEffect(() => {
    if (activeSlideIndex < slides.length) {
      return;
    }

    setActiveSlideIndex(0);
  }, [activeSlideIndex, slides.length]);

  function handleScroll(event) {
    const scroller = event.currentTarget;
    const slideElements = Array.from(scroller.querySelectorAll('.advertisingCarousel-slide'));
    const scrollerLeft = scroller.getBoundingClientRect().left;
    let nextIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    slideElements.forEach((slide, index) => {
      const distance = Math.abs(slide.getBoundingClientRect().left - scrollerLeft);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nextIndex = index;
      }
    });

    setActiveSlideIndex(currentIndex => (currentIndex === nextIndex ? currentIndex : nextIndex));
  }

  function scrollToSlide(index) {
    const slider = sliderRef.current;
    const slide = slider?.querySelectorAll('.advertisingCarousel-slide')[index];

    if (!slide) {
      return;
    }

    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    slide.scrollIntoView({ behavior, block: 'nearest', inline: 'start' });
    setActiveSlideIndex(index);
  }

  if (!slides.length) {
    return null;
  }

  return (
    <>
      <div
        className="advertisingCarousel"
        hidden={hidden}
        id={id}
        onScroll={handleScroll}
        ref={sliderRef}
      >
        {slides.map((slide, index) => (
          <div className="advertisingCarousel-slide" key={slide.key ?? index}>
            {slide}
          </div>
        ))}
      </div>

      {slides.length > 1 ? (
        <div className="advertisingCarousel-dots" hidden={hidden} aria-label={paginationLabel}>
          {slides.map((slide, index) => (
            <button
              className={`advertisingCarousel-dot${activeSlideIndex === index ? ' is-active' : ''}`}
              type="button"
              aria-current={activeSlideIndex === index ? 'true' : undefined}
              aria-label={getSlideLabel ? getSlideLabel(index) : undefined}
              key={slide.key ?? index}
              onClick={() => scrollToSlide(index)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
