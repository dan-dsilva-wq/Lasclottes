/* ============================================================
   Lasclottes — Main JS (Old version, reconstructed)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const nav = document.getElementById('nav');

    /* ---- Mobile Menu ---- */
    const hamburger = document.querySelector('.nav__hamburger');
    const mobileMenu = document.querySelector('.nav__menu');

    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
            const isOpen = mobileMenu.classList.toggle('open');
            hamburger.classList.toggle('active');
            hamburger.setAttribute('aria-expanded', String(isOpen));
            body.style.overflow = isOpen ? 'hidden' : '';
        });

        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('open');
                hamburger.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
                body.style.overflow = '';
            });
        });
    }

    /* ---- Sticky Nav + Hide on scroll down, show on scroll up ---- */
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
        if (nav) {
            const currentScrollY = window.scrollY;
            nav.classList.toggle('nav--scrolled', currentScrollY > 80);

            if (currentScrollY < 80) {
                nav.classList.remove('nav--hidden');
            } else if (currentScrollY > lastScrollY) {
                nav.classList.add('nav--hidden');
            } else {
                nav.classList.remove('nav--hidden');
            }
            lastScrollY = currentScrollY;
        }
    };

    /* ---- Hero Slideshow with dots ---- */
    let slides = Array.from(document.querySelectorAll('.hero-slide'));
    const dotsContainer = document.querySelector('.hero__dots');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointerDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const devicePx = Math.ceil(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2));
    const heroTargetWidth = devicePx <= 900 ? 768 : (devicePx <= 1400 ? 1280 : 1600);
    const supportsImageSet = typeof CSS !== 'undefined'
        && typeof CSS.supports === 'function'
        && (
            CSS.supports('background-image', 'image-set(url("x.webp") 1x)')
            || CSS.supports('background-image', '-webkit-image-set(url("x.webp") 1x)')
        );
    let currentSlide = 0;
    let slideTimer = null;

    // Limit the number of hero slides on mobile/coarse-pointer devices to reduce
    // layer memory pressure on Safari/iOS.
    const mobileHeroSlideLimit = 4;
    if ((isCoarsePointerDevice || window.innerWidth <= 900) && slides.length > mobileHeroSlideLimit) {
        slides.slice(mobileHeroSlideLimit).forEach((slide) => slide.remove());
        slides = slides.slice(0, mobileHeroSlideLimit);
    }

    /* Build dot indicators */
    if (dotsContainer && slides.length > 1) {
        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'hero__dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Slide ${i + 1}`);
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        });
    }

    const dots = Array.from(document.querySelectorAll('.hero__dot'));

    const optimizedKey = (path) => path
        .toLowerCase()
        .replace(/\\/g, '/')
        .replace(/^(\.\.\/)+/, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const optimizedImagePath = (originalPath, format) => {
        const key = optimizedKey(originalPath);
        const relPrefix = originalPath.startsWith('../') ? '../' : '';
        return `${relPrefix}Media/optimized/${key}-w${heroTargetWidth}.${format}`;
    };

    const hydrateSlideBackground = (slide) => {
        if (!slide) return;
        const bg = slide.getAttribute('data-bg');
        if (!bg) return;
        if (slide.dataset.bgApplied === '1') return;
        const webp = optimizedImagePath(bg, 'webp');
        const avif = optimizedImagePath(bg, 'avif');
        if (supportsImageSet) {
            slide.style.backgroundImage = `-webkit-image-set(url('${avif}') type('image/avif'), url('${webp}') type('image/webp'), url('${bg}'))`;
            slide.style.backgroundImage = `image-set(url('${avif}') type('image/avif'), url('${webp}') type('image/webp'), url('${bg}'))`;
        } else {
            slide.style.backgroundImage = `url('${bg}')`;
        }
        slide.dataset.bgApplied = '1';
        slide.removeAttribute('data-bg');
    };

    const hydrateSlidesAround = (index) => {
        hydrateSlideBackground(slides[index]);
        if (slides.length > 1) {
            hydrateSlideBackground(slides[(index + 1) % slides.length]);
        }
    };

    const showSlide = (index) => {
        hydrateSlidesAround(index);
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));
        if (slides[index]) slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
    };

    const goToSlide = (index) => {
        currentSlide = index;
        showSlide(currentSlide);
        if (!prefersReducedMotion) {
            clearTimeout(slideTimer);
            scheduleNextSlide();
        }
    };

    const scheduleNextSlide = () => {
        slideTimer = setTimeout(() => {
            requestAnimationFrame(() => {
                currentSlide = (currentSlide + 1) % slides.length;
                showSlide(currentSlide);
                scheduleNextSlide();
            });
        }, 6000);
    };

    if (slides.length > 1) {
        hydrateSlidesAround(0);
        showSlide(0);
        if (!prefersReducedMotion) {
            scheduleNextSlide();
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (prefersReducedMotion || slides.length <= 1) return;
        if (document.hidden) {
            clearTimeout(slideTimer);
            return;
        }
        clearTimeout(slideTimer);
        scheduleNextSlide();
    });

    /* ---- Smooth Scroll ---- */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const id = anchor.getAttribute('href');
            if (id === '#') return;
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                const offset = nav ? nav.offsetHeight : 0;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    /* ---- Active Nav Highlight ---- */
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link');

    const highlightNav = () => {
        const scrollPos = window.scrollY + 120;
        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');
            if (scrollPos >= top && scrollPos < top + height) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + id) {
                        link.classList.add('active');
                    }
                });
            }
        });
    };

    /* ---- Gallery: Show-More + Filters ---- */
    const filterBtns = Array.from(document.querySelectorAll('.gallery-filter'));
    let galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
    const galleryGrid = document.querySelector('.gallery__grid');
    const showMoreBtn = document.getElementById('galleryShowMore');
    const INITIAL_SHOW = 12;
    const MOBILE_GALLERY_DOM_LIMIT = 24;
    let galleryExpanded = false;
    let deferredGalleryItems = [];

    const itemMatchesFilter = (item, filter) => filter === 'all' || item.dataset.category === filter;
    const applyGalleryItemCursor = () => {
        galleryItems.forEach((item) => {
            item.style.cursor = 'pointer';
        });
    };
    const matchingItemCount = (filter) => {
        const inDomCount = galleryItems.filter((item) => itemMatchesFilter(item, filter)).length;
        const deferredCount = deferredGalleryItems.filter((item) => itemMatchesFilter(item, filter)).length;
        return inDomCount + deferredCount;
    };

    // Keep initial mobile DOM light: defer part of the gallery until a user
    // explicitly asks to view all photos.
    if (galleryGrid && (isCoarsePointerDevice || window.innerWidth <= 900) && galleryItems.length > MOBILE_GALLERY_DOM_LIMIT) {
        deferredGalleryItems = galleryItems.slice(MOBILE_GALLERY_DOM_LIMIT);
        deferredGalleryItems.forEach((item) => item.remove());
        galleryItems = galleryItems.slice(0, MOBILE_GALLERY_DOM_LIMIT);
    }

    const restoreDeferredGalleryItems = () => {
        if (!galleryGrid || !deferredGalleryItems.length) return;
        const fragment = document.createDocumentFragment();
        deferredGalleryItems.forEach((item) => fragment.appendChild(item));
        galleryGrid.appendChild(fragment);
        deferredGalleryItems = [];
        galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
        applyGalleryItemCursor();
    };

    /* Initial state: hide items beyond INITIAL_SHOW */
    const applyShowMore = () => {
        if (galleryExpanded) return;
        const activeFilter = document.querySelector('.gallery-filter.active')?.dataset.filter || 'all';
        let visibleCount = 0;
        let displayedCount = 0;

        galleryItems.forEach((item) => {
            const matches = itemMatchesFilter(item, activeFilter);
            if (!matches) {
                item.classList.remove('gallery-hidden');
                item.style.display = 'none';
                return;
            }

            visibleCount++;
            if (visibleCount > INITIAL_SHOW) {
                item.classList.add('gallery-hidden');
                item.style.display = 'none';
            } else {
                item.classList.remove('gallery-hidden');
                item.style.display = '';
                displayedCount++;
            }
        });

        if (showMoreBtn) {
            const totalMatching = matchingItemCount(activeFilter);
            const remaining = totalMatching - displayedCount;
            if (remaining > 0) {
                showMoreBtn.parentElement.style.display = '';
                showMoreBtn.textContent = `View All Photos (${remaining} more)`;
            } else {
                showMoreBtn.parentElement.style.display = 'none';
            }
        }
    };

    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            restoreDeferredGalleryItems();
            galleryExpanded = true;
            const activeFilter = document.querySelector('.gallery-filter.active')?.dataset.filter || 'all';

            galleryItems.forEach((item) => {
                item.classList.remove('gallery-hidden');
                item.style.display = itemMatchesFilter(item, activeFilter) ? '' : 'none';
            });
            showMoreBtn.parentElement.style.display = 'none';
        });
    }

    applyShowMore();
    applyGalleryItemCursor();

    /* Smooth filter transitions */
    filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;

            /* Fade out all visible items first */
            galleryItems.forEach((item) => item.classList.add('fade-out'));

            setTimeout(() => {
                let count = 0;
                let displayedCount = 0;

                galleryItems.forEach((item) => {
                    const matches = itemMatchesFilter(item, filter);
                    item.classList.remove('gallery-hidden');

                    if (!matches) {
                        item.style.display = 'none';
                        return;
                    }

                    if (!galleryExpanded) {
                        count++;
                        if (count > INITIAL_SHOW) {
                            item.classList.add('gallery-hidden');
                            item.style.display = 'none';
                        } else {
                            item.style.display = '';
                            displayedCount++;
                        }
                    } else {
                        item.style.display = '';
                    }
                });

                if (!galleryExpanded && showMoreBtn) {
                    const totalMatching = matchingItemCount(filter);
                    const remaining = totalMatching - displayedCount;
                    if (remaining > 0) {
                        showMoreBtn.parentElement.style.display = '';
                        showMoreBtn.textContent = `View All Photos (${remaining} more)`;
                    } else {
                        showMoreBtn.parentElement.style.display = 'none';
                    }
                } else if (showMoreBtn) {
                    showMoreBtn.parentElement.style.display = 'none';
                }

                /* Fade in after short delay */
                requestAnimationFrame(() => {
                    galleryItems.forEach((item) => item.classList.remove('fade-out'));
                });
            }, 250);
        });
    });

    /* ---- Lightbox ---- */
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = lightbox ? lightbox.querySelector('.lightbox__image') : null;
    const lightboxClose = lightbox ? lightbox.querySelector('.lightbox__close') : null;
    const lightboxPrev = lightbox ? lightbox.querySelector('.lightbox__prev') : null;
    const lightboxNext = lightbox ? lightbox.querySelector('.lightbox__next') : null;
    const lightboxCounter = lightbox ? lightbox.querySelector('.lightbox__counter') : null;

    let lightboxImages = [];
    let lightboxIndex = 0;
    let touchStartX = 0;
    let touchEndX = 0;
    const getLightboxSource = (imgEl) => imgEl?.dataset?.full || imgEl?.currentSrc || imgEl?.src || '';

    const openLightbox = (index) => {
        lightboxImages = Array.from(document.querySelectorAll('.gallery-item:not([style*="display: none"]) img'));
        lightboxIndex = index;
        if (lightbox && lightboxImg && lightboxImages[index]) {
            lightboxImg.src = getLightboxSource(lightboxImages[index]);
            lightboxImg.alt = lightboxImages[index].alt;
            lightbox.hidden = false;
            lightbox.classList.add('active');
            body.style.overflow = 'hidden';
            updateCounter();
        }
    };

    const closeLightbox = () => {
        if (lightbox) {
            lightbox.classList.remove('active');
            lightbox.hidden = true;
            body.style.overflow = '';
        }
    };

    const showLightboxPrev = () => {
        lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
        if (lightboxImg && lightboxImages[lightboxIndex]) {
            lightboxImg.src = getLightboxSource(lightboxImages[lightboxIndex]);
            lightboxImg.alt = lightboxImages[lightboxIndex].alt;
        }
        updateCounter();
    };

    const showLightboxNext = () => {
        lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
        if (lightboxImg && lightboxImages[lightboxIndex]) {
            lightboxImg.src = getLightboxSource(lightboxImages[lightboxIndex]);
            lightboxImg.alt = lightboxImages[lightboxIndex].alt;
        }
        updateCounter();
    };

    const updateCounter = () => {
        if (lightboxCounter) {
            lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
        }
    };

    if (galleryGrid) {
        galleryGrid.addEventListener('click', (event) => {
            const item = event.target.closest('.gallery-item');
            if (!item || !galleryGrid.contains(item)) return;
            if (item.style.display === 'none') return;

            const visibleItems = Array.from(document.querySelectorAll('.gallery-item:not([style*="display: none"])'));
            const visibleIndex = visibleItems.indexOf(item);
            if (visibleIndex >= 0) {
                openLightbox(visibleIndex);
            }
        });
    }

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxPrev) lightboxPrev.addEventListener('click', showLightboxPrev);
    if (lightboxNext) lightboxNext.addEventListener('click', showLightboxNext);

    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.classList.contains('lightbox__content')) {
                closeLightbox();
            }
        });

        // Touch swipe support
        lightbox.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        lightbox.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) showLightboxNext();
                else showLightboxPrev();
            }
        }, { passive: true });
    }

    /* ---- Keyboard Nav ---- */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLightbox();
            if (mobileMenu && mobileMenu.classList.contains('open')) {
                mobileMenu.classList.remove('open');
                hamburger?.classList.remove('active');
                hamburger?.setAttribute('aria-expanded', 'false');
                body.style.overflow = '';
            }
        }
        if (lightbox && !lightbox.hidden) {
            if (e.key === 'ArrowLeft') showLightboxPrev();
            if (e.key === 'ArrowRight') showLightboxNext();
        }
    });

    /* ---- Mobile CTA Bar ---- */
    const mobileCta = document.getElementById('mobileCta');

    const handleMobileCta = () => {
        if (!mobileCta) return;
        const heroBottom = document.querySelector('.hero')?.offsetHeight || 600;
        const contactTop = document.getElementById('contact')?.offsetTop || Infinity;
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;

        if (scrollY > heroBottom && scrollY + windowHeight < contactTop + 200) {
            mobileCta.classList.add('visible');
        } else {
            mobileCta.classList.remove('visible');
        }
        lastScrollY = scrollY;
    };

    /* ---- Scroll Reveal (Intersection Observer) ---- */
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

    /* ---- Lazy Load Iframes ---- */
    const iframeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const iframe = entry.target;
                if (iframe.dataset.src) {
                    iframe.src = iframe.dataset.src;
                    iframeObserver.unobserve(iframe);
                }
            }
        });
    }, { rootMargin: '200px' });

    document.querySelectorAll('iframe[data-src]').forEach(iframe => iframeObserver.observe(iframe));

    /* ---- Lazy background images for activity cards ---- */
    const activityCards = document.querySelectorAll('.activity-card[data-bg]');
    const hydrateActivityCard = (card) => {
        if (!card || card.dataset.bgApplied === '1') return;
        const bg = card.getAttribute('data-bg');
        if (!bg) return;
        card.style.backgroundImage = `url('${bg}')`;
        card.dataset.bgApplied = '1';
    };

    if (activityCards.length) {
        const activityCardObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                hydrateActivityCard(entry.target);
                activityCardObserver.unobserve(entry.target);
            });
        }, { rootMargin: '250px' });

        activityCards.forEach(card => activityCardObserver.observe(card));
    }

    /* ---- Form Validation ---- */
    const bookingForm = document.getElementById('bookingForm') || document.getElementById('contactForm');
    const formStatus = document.getElementById('formStatus');
    const isFrenchPage = document.documentElement.lang?.toLowerCase().startsWith('fr');

    if (bookingForm) {
        const arrivalInput = document.getElementById('arrivalDate');
        const departureInput = document.getElementById('departureDate');
        const adultsInput = document.getElementById('adults');
        const childrenInput = document.getElementById('children');
        const nightsOutput = document.getElementById('bookingNights');
        const guestsOutput = document.getElementById('bookingGuests');
        const totalOutput = document.getElementById('bookingTotal');
        const depositOutput = document.getElementById('bookingDeposit');
        const summaryWarning = document.getElementById('bookingSummaryWarning');
        const hiddenNights = document.getElementById('stayNights');
        const hiddenGuests = document.getElementById('totalGuests');
        const hiddenTotal = document.getElementById('estimatedStayTotal');
        const hiddenDeposit = document.getElementById('estimatedDeposit');
        const redirectField = document.getElementById('formRedirect');
        const wiseBaseUrl = bookingForm.dataset.wisePaymentUrl || '';

        const formatGbp = (value) => {
            if (!Number.isFinite(value) || value <= 0) return '-';
            return `\u00A3${Math.round(value).toLocaleString('en-GB')}`;
        };

        const toDate = (value) => {
            if (!value) return null;
            const date = new Date(value);
            return Number.isNaN(date.valueOf()) ? null : date;
        };

        const seasonForStay = (arrivalDate, departureDate) => {
            if (!arrivalDate || !departureDate || departureDate <= arrivalDate) {
                return { code: 'invalid' };
            }
            const months = new Set();
            const cursor = new Date(arrivalDate);
            while (cursor < departureDate) {
                months.add(cursor.getMonth());
                cursor.setDate(cursor.getDate() + 1);
            }
            const hasClosedMonth = [...months].some((month) => ![4, 5, 6, 7, 8].includes(month));
            if (hasClosedMonth) return { code: 'closed', minNights: 0, rate: 0, label: 'Closed' };
            const hasHighSeasonMonth = [...months].some((month) => [6, 7].includes(month));
            if (hasHighSeasonMonth) return { code: 'high', minNights: 7, rate: 3300 / 7, label: 'High Season' };
            return { code: 'mid', minNights: 4, rate: 250, reducedRate: 200, label: 'Spring & Autumn' };
        };

        const calculateQuote = () => {
            const arrivalDate = toDate(arrivalInput?.value);
            const departureDate = toDate(departureInput?.value);
            const adults = Math.max(0, Number(adultsInput?.value || 0));
            const children = Math.max(0, Number(childrenInput?.value || 0));
            const guests = adults + children;
            const nights = (arrivalDate && departureDate) ? Math.round((departureDate - arrivalDate) / (1000 * 60 * 60 * 24)) : 0;
            const season = seasonForStay(arrivalDate, departureDate);

            let total = 0;
            let deposit = 0;
            let warning = '';

            if (season.code === 'closed') {
                warning = isFrenchPage
                    ? 'Hors saison : octobre \u00E0 avril non disponible actuellement.'
                    : 'Out of season: October to April is currently closed.';
            } else if (season.code === 'invalid') {
                warning = '';
            } else if (nights < season.minNights) {
                warning = isFrenchPage
                    ? `S\u00E9jour minimum : ${season.minNights} nuits pour cette p\u00E9riode.`
                    : `Minimum stay: ${season.minNights} nights for this period.`;
            } else if (guests < 1) {
                warning = isFrenchPage
                    ? 'Ajoutez au moins un adulte pour obtenir un tarif.'
                    : 'Add at least one adult to calculate pricing.';
            } else {
                if (season.code === 'mid') {
                    const nightlyRate = guests <= 6 ? season.reducedRate : season.rate;
                    total = nightlyRate * nights;
                } else {
                    total = season.rate * nights;
                }
                deposit = total * 0.25;
            }

            if (nightsOutput) nightsOutput.textContent = nights > 0 ? String(nights) : '-';
            if (guestsOutput) guestsOutput.textContent = guests > 0 ? String(guests) : '-';
            if (totalOutput) totalOutput.textContent = formatGbp(total);
            if (depositOutput) depositOutput.textContent = formatGbp(deposit);
            if (summaryWarning) summaryWarning.textContent = warning;

            if (hiddenNights) hiddenNights.value = nights > 0 ? String(nights) : '';
            if (hiddenGuests) hiddenGuests.value = guests > 0 ? String(guests) : '';
            if (hiddenTotal) hiddenTotal.value = total > 0 ? total.toFixed(2) : '';
            if (hiddenDeposit) hiddenDeposit.value = deposit > 0 ? deposit.toFixed(2) : '';

            return { arrivalDate, departureDate, adults, children, guests, nights, season, total, deposit, warning };
        };

        const updateDepartureMin = () => {
            if (!arrivalInput || !departureInput) return;
            departureInput.min = arrivalInput.value || arrivalInput.min;
        };

        if (arrivalInput) {
            const today = new Date().toISOString().split('T')[0];
            arrivalInput.min = today;
            arrivalInput.addEventListener('change', () => {
                updateDepartureMin();
                calculateQuote();
            });
        }
        if (departureInput) departureInput.addEventListener('change', calculateQuote);
        if (adultsInput) adultsInput.addEventListener('input', calculateQuote);
        if (childrenInput) childrenInput.addEventListener('input', calculateQuote);

        updateDepartureMin();
        calculateQuote();

        bookingForm.addEventListener('submit', (e) => {
            const quote = calculateQuote();

            if (quote.departureDate && quote.arrivalDate && quote.departureDate <= quote.arrivalDate) {
                e.preventDefault();
                if (formStatus) {
                    formStatus.textContent = isFrenchPage
                        ? "La date de d\u00E9part doit \u00EAtre post\u00E9rieure \u00E0 la date d'arriv\u00E9e."
                        : 'Departure date must be after arrival date.';
                    formStatus.className = 'form-status error';
                }
                return;
            }

            if (quote.warning || quote.total <= 0 || quote.deposit <= 0) {
                e.preventDefault();
                if (formStatus) {
                    formStatus.textContent = quote.warning || (isFrenchPage
                        ? 'Merci de compl\u00E9ter les dates et le nombre de personnes.'
                        : 'Please complete dates and guest details first.');
                    formStatus.className = 'form-status error';
                }
                return;
            }

            const wiseReady = Boolean(wiseBaseUrl) && !wiseBaseUrl.includes('REPLACE_WITH_YOUR_WISE_PAYMENT_LINK');

            if (redirectField && wiseReady) {
                try {
                    const paymentUrl = new URL(wiseBaseUrl);
                    paymentUrl.searchParams.set('amount', quote.deposit.toFixed(2));
                    paymentUrl.searchParams.set('currency', 'GBP');
                    paymentUrl.searchParams.set('source', 'website-booking');
                    redirectField.value = paymentUrl.toString();
                } catch (_) {
                    redirectField.value = wiseBaseUrl;
                }
            }

            if (formStatus) {
                formStatus.textContent = wiseReady
                    ? (isFrenchPage
                        ? 'Envoi des d\u00E9tails puis redirection vers le paiement s\u00E9curis\u00E9...'
                        : 'Submitting details and redirecting to secure payment...')
                    : (isFrenchPage
                        ? 'Envoi de votre demande... (ajoutez votre lien Wise dans le formulaire pour activer la redirection paiement instantan\u00E9e).'
                        : 'Sending your request... (add your Wise payment link in the form to enable instant payment redirect).');
                formStatus.className = 'form-status sending';
            }
        });
    }

    /* ---- Combined Scroll Handler ---- */
    let ticking = false;
    const onScroll = () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                handleScroll();
                highlightNav();
                handleMobileCta();
                ticking = false;
            });
            ticking = true;
        }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    handleScroll();
    highlightNav();
    handleMobileCta();
});
