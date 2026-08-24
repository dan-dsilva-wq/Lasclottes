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

    const optimizedImagePath = (originalPath) => {
        const key = optimizedKey(originalPath);
        const relPrefix = originalPath.startsWith('../') ? '../' : '';
        return `${relPrefix}Media/optimized/${key}-w${heroTargetWidth}.webp`;
    };

    const hydrateSlideBackground = (slide) => {
        if (!slide) return;
        const bg = slide.getAttribute('data-bg');
        if (!bg) return;
        if (slide.dataset.bgApplied === '1') return;
        const webp = optimizedImagePath(bg);
        slide.style.backgroundImage = `url('${webp}')`;
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

    /* ---- Load Google Maps only after a visitor explicitly chooses it ---- */
    document.querySelectorAll('.map-consent[data-map-src]').forEach(map => {
        const loadButton = map.querySelector('.map-consent__load');
        if (!loadButton) return;

        loadButton.addEventListener('click', () => {
            if (map.dataset.loaded === '1') return;

            const iframe = document.createElement('iframe');
            iframe.src = map.dataset.mapSrc;
            iframe.title = map.dataset.mapTitle || 'Lasclottes on Google Maps';
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer';
            iframe.allowFullscreen = true;

            map.replaceChildren(iframe);
            map.dataset.loaded = '1';
        }, { once: true });
    });

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

    /* ---- Activity information freshness notice ---- */
    const activityContainer = document.querySelector('.activity-content > .container');
    if (activityContainer) {
        const currentInfoNotice = document.createElement('p');
        currentInfoNotice.className = 'activity-current-info';
        currentInfoNotice.textContent = 'Opening times, availability and prices can change. Please check the linked official website before travelling.';
        activityContainer.appendChild(currentInfoNotice);
    }

    /* ---- Form Validation ---- */
    const bookingForm = document.getElementById('bookingForm') || document.getElementById('contactForm');
    const formStatus = document.getElementById('formStatus');
    const pageLang = document.documentElement.lang?.toLowerCase() || 'en';
    const isFrenchPage = pageLang.startsWith('fr');
    const isDutchPage = pageLang.startsWith('nl');
    const i18n = (en, fr, nl) => {
        if (isFrenchPage) return fr;
        if (isDutchPage) return nl;
        return en;
    };

    if (bookingForm) {
        const arrivalInput = document.getElementById('arrivalDate');
        const departureInput = document.getElementById('departureDate');
        const adultsInput = document.getElementById('adults');
        const childrenInput = document.getElementById('children');
        const nightsOutput = document.getElementById('bookingNights');
        const guestsOutput = document.getElementById('bookingGuests');
        const totalOutput = document.getElementById('bookingTotal');
        const depositOutput = document.getElementById('bookingDeposit');
        const depositLabelOutput = document.getElementById('bookingDepositLabel');
        const touristTaxOutput = document.getElementById('bookingTouristTax');
        const damageDepositOutput = document.getElementById('bookingDamageDeposit');
        const balanceOutput = document.getElementById('bookingBalance');
        const balanceLabelOutput = document.getElementById('bookingBalanceLabel');
        const summaryWarning = document.getElementById('bookingSummaryWarning');
        const hiddenNights = document.getElementById('stayNights');
        const hiddenGuests = document.getElementById('totalGuests');
        const hiddenTotal = document.getElementById('estimatedStayTotal');
        const hiddenDeposit = document.getElementById('estimatedDeposit');
        const hiddenTouristTax = document.getElementById('touristTax');
        const hiddenDamageDeposit = document.getElementById('damageDeposit');
        const hiddenDueNow = document.getElementById('amountDueNow');
        const hiddenBalanceLater = document.getElementById('balanceDueLater');
        const hiddenPaymentStage = document.getElementById('paymentStage');
        const agreementInput = document.getElementById('equipmentAgreement');
        const submitButton = bookingForm.querySelector('button[type="submit"]');
        const stripeCheckoutEndpoint = bookingForm.dataset.stripeCheckoutEndpoint || '/api/create-stripe-checkout';
        const touristTaxEurPerAdultNight = 1.41;
        const refundableDamageDeposit = 500;
        const depositRate = 0.25;
        const fullPaymentWindowDays = 60;
        const maxGuests = 12;
        const availabilityStatus = document.getElementById('availabilityStatus');
        let availabilityState = 'loading';
        let blockedDateRanges = [];
        let checkoutPayloadSignature = '';
        let checkoutRequestId = '';

        const newCheckoutRequestId = () => {
            if (window.crypto?.randomUUID) return window.crypto.randomUUID();
            const bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        };

        const formatGbp = (value) => {
            if (!Number.isFinite(value) || value <= 0) return '-';
            return `\u00A3${value.toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        };

        const formatEur = (value) => {
            if (!Number.isFinite(value) || value <= 0) return '-';
            return `\u20AC${value.toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        };

        const toDate = (value) => {
            if (!value) return null;
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
            if (!match) return null;
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const date = new Date(Date.UTC(year, month - 1, day));
            if (
                date.getUTCFullYear() !== year
                || date.getUTCMonth() !== month - 1
                || date.getUTCDate() !== day
            ) return null;
            return date;
        };

        const seasonForStay = (arrivalDate, departureDate) => {
            if (!arrivalDate || !departureDate || departureDate <= arrivalDate) {
                return { code: 'invalid' };
            }
            const months = new Set();
            const cursor = new Date(arrivalDate);
            while (cursor < departureDate) {
                months.add(cursor.getUTCMonth());
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
            const hasClosedMonth = [...months].some((month) => ![4, 5, 6, 7, 8].includes(month));
            if (hasClosedMonth) return { code: 'closed', minNights: 0, rate: 0, label: 'Closed' };
            const hasHighSeasonMonth = [...months].some((month) => [6, 7].includes(month));
            if (hasHighSeasonMonth) {
                return {
                    code: 'high',
                    minNights: 7,
                    rate: 3300 / 7,
                    label: 'High Season',
                    requiresSaturdayTurnover: true
                };
            }
            return { code: 'mid', minNights: 4, rate: 250, reducedRate: 200, label: 'Spring & Autumn' };
        };

        const unavailableRangeForStay = (arrivalDate, departureDate) => {
            if (!arrivalDate || !departureDate || departureDate <= arrivalDate) return null;
            return blockedDateRanges.find((range) => {
                const blockStart = toDate(range.start);
                const blockEnd = toDate(range.end);
                return blockStart && blockEnd && arrivalDate < blockEnd && departureDate > blockStart;
            }) || null;
        };

        const calculateQuote = () => {
            const arrivalDate = toDate(arrivalInput?.value);
            const departureDate = toDate(departureInput?.value);
            const adults = Math.max(0, Number(adultsInput?.value || 0));
            const children = Math.max(0, Number(childrenInput?.value || 0));
            const guests = adults + children;
            const nights = (arrivalDate && departureDate) ? Math.round((departureDate - arrivalDate) / (1000 * 60 * 60 * 24)) : 0;
            const season = seasonForStay(arrivalDate, departureDate);

            let stayTotal = 0;
            let amountDueNow = 0;
            let balanceDueLater = 0;
            let touristTax = 0;
            let damageDeposit = 0;
            let warning = '';
            let daysUntilArrival = null;
            let withinFullPaymentWindow = false;
            let validHighSeasonPattern = true;
            const unavailableRange = unavailableRangeForStay(arrivalDate, departureDate);

            if (arrivalDate) {
                const today = toDate(new Date().toISOString().slice(0, 10));
                daysUntilArrival = Math.ceil((arrivalDate - today) / (1000 * 60 * 60 * 24));
                withinFullPaymentWindow = daysUntilArrival <= fullPaymentWindowDays;
            }

            if (season.code === 'high' && arrivalDate && departureDate) {
                validHighSeasonPattern = arrivalDate.getUTCDay() === 6
                    && departureDate.getUTCDay() === 6
                    && nights % 7 === 0;
            }

            if (season.code === 'closed') {
                warning = i18n(
                    'Out of season: October to April is currently closed.',
                    'Hors saison : octobre \u00E0 avril non disponible actuellement.',
                    'Buiten het seizoen: oktober tot april is momenteel gesloten.'
                );
            } else if (season.code === 'invalid') {
                warning = '';
            } else if (availabilityState === 'loading') {
                warning = i18n(
                    'Checking live availability…',
                    'Vérification des disponibilités…',
                    'Beschikbaarheid controleren…'
                );
            } else if (availabilityState === 'error') {
                warning = i18n(
                    'Availability could not be checked. Please contact us before booking.',
                    'Les disponibilités ne peuvent pas être vérifiées. Merci de nous contacter avant de réserver.',
                    'De beschikbaarheid kon niet worden gecontroleerd. Neem contact met ons op voordat u boekt.'
                );
            } else if (unavailableRange) {
                warning = i18n(
                    'Those dates are already booked or unavailable. Please choose different dates.',
                    'Ces dates sont déjà réservées ou indisponibles. Merci d’en choisir d’autres.',
                    'Deze datums zijn al geboekt of niet beschikbaar. Kies andere datums.'
                );
            } else if (guests > maxGuests) {
                warning = i18n(
                    `Maximum occupancy is ${maxGuests} guests.`,
                    `La capacit\u00E9 maximale est de ${maxGuests} personnes.`,
                    `De maximale bezetting is ${maxGuests} gasten.`
                );
            } else if (nights < season.minNights) {
                warning = i18n(
                    `Minimum stay: ${season.minNights} nights for this period.`,
                    `S\u00E9jour minimum : ${season.minNights} nuits pour cette p\u00E9riode.`,
                    `Minimaal verblijf: ${season.minNights} nachten voor deze periode.`
                );
            } else if (season.code === 'high' && !validHighSeasonPattern) {
                warning = i18n(
                    'July and August bookings must run Saturday to Saturday (weekly blocks).',
                    'En juillet et ao\u00FBt, les s\u00E9jours doivent aller du samedi au samedi (par semaines).',
                    'Boekingen in juli en augustus moeten van zaterdag tot zaterdag lopen (wekelijkse blokken).'
                );
            } else if (guests < 1) {
                warning = i18n(
                    'Add at least one adult to calculate pricing.',
                    'Ajoutez au moins un adulte pour obtenir un tarif.',
                    'Voeg minimaal één volwassene toe om de prijs te berekenen.'
                );
            } else {
                if (season.code === 'mid') {
                    const nightlyRate = guests <= 6 ? season.reducedRate : season.rate;
                    stayTotal = nightlyRate * nights;
                } else {
                    stayTotal = season.rate * nights;
                }
                damageDeposit = refundableDamageDeposit;
                touristTax = adults * nights * touristTaxEurPerAdultNight;
                if (withinFullPaymentWindow) {
                    amountDueNow = stayTotal + damageDeposit;
                    balanceDueLater = 0;
                } else {
                    amountDueNow = stayTotal * depositRate;
                    balanceDueLater = (stayTotal - amountDueNow) + damageDeposit;
                }
            }

            if (nightsOutput) nightsOutput.textContent = nights > 0 ? String(nights) : '-';
            if (guestsOutput) guestsOutput.textContent = guests > 0 ? String(guests) : '-';
            if (totalOutput) totalOutput.textContent = formatGbp(stayTotal);
            if (touristTaxOutput) touristTaxOutput.textContent = formatEur(touristTax);
            if (damageDepositOutput) damageDepositOutput.textContent = formatGbp(damageDeposit);
            if (depositOutput) depositOutput.textContent = formatGbp(amountDueNow);
            if (balanceOutput) balanceOutput.textContent = formatGbp(balanceDueLater);
            if (depositLabelOutput) {
                depositLabelOutput.textContent = withinFullPaymentWindow
                    ? i18n(
                        'Full Amount Due Now',
                        'Montant Total à Régler Maintenant',
                        'Volledig Bedrag Nu Verschuldigd'
                    )
                    : i18n(
                        'Deposit Due Now (25%)',
                        'Acompte à Régler Maintenant (25%)',
                        'Aanbetaling Nu Verschuldigd (25%)'
                    );
            }
            if (balanceLabelOutput) {
                balanceLabelOutput.textContent = i18n(
                    `Balance Due ${fullPaymentWindowDays} Days Before Arrival`,
                    `Solde dû ${fullPaymentWindowDays} jours avant l'arrivée`,
                    `Restsaldo ${fullPaymentWindowDays} dagen voor aankomst verschuldigd`
                );
            }
            if (summaryWarning) summaryWarning.textContent = warning;

            if (hiddenNights) hiddenNights.value = nights > 0 ? String(nights) : '';
            if (hiddenGuests) hiddenGuests.value = guests > 0 ? String(guests) : '';
            if (hiddenTotal) hiddenTotal.value = stayTotal > 0 ? stayTotal.toFixed(2) : '';
            if (hiddenDeposit) hiddenDeposit.value = amountDueNow > 0 ? amountDueNow.toFixed(2) : '';
            if (hiddenTouristTax) hiddenTouristTax.value = touristTax > 0 ? touristTax.toFixed(2) : '';
            if (hiddenDamageDeposit) hiddenDamageDeposit.value = damageDeposit > 0 ? damageDeposit.toFixed(2) : '';
            if (hiddenDueNow) hiddenDueNow.value = amountDueNow > 0 ? amountDueNow.toFixed(2) : '';
            if (hiddenBalanceLater) hiddenBalanceLater.value = balanceDueLater > 0 ? balanceDueLater.toFixed(2) : '';
            if (hiddenPaymentStage) {
                hiddenPaymentStage.value = withinFullPaymentWindow
                    ? 'full_payment_now'
                    : 'deposit_now_balance_later';
            }

            return {
                arrivalDate,
                departureDate,
                adults,
                children,
                guests,
                nights,
                season,
                stayTotal,
                amountDueNow,
                balanceDueLater,
                touristTax,
                damageDeposit,
                warning,
                daysUntilArrival,
                withinFullPaymentWindow
            };
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

        const fetchAvailability = () => fetch('/api/availability', { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) throw new Error('Live availability request failed');
                return response;
            })
            .catch(() => fetch('/data/availability.json', { cache: 'no-store' }));

        fetchAvailability()
            .then((response) => {
                if (!response.ok) throw new Error('Availability request failed');
                return response.json();
            })
            .then((data) => {
                if (!Array.isArray(data.blocked)) throw new Error('Availability data is invalid');
                blockedDateRanges = data.blocked;
                availabilityState = 'ready';
                if (availabilityStatus) {
                    availabilityStatus.textContent = i18n(
                        `Availability last checked ${data.updated}. Your chosen dates are checked automatically.`,
                        `Disponibilités mises à jour le ${data.updated}. Les dates choisies sont vérifiées automatiquement.`,
                        `Beschikbaarheid bijgewerkt op ${data.updated}. De gekozen datums worden automatisch gecontroleerd.`
                    );
                }
                calculateQuote();
            })
            .catch(() => {
                availabilityState = 'error';
                if (availabilityStatus) {
                    availabilityStatus.textContent = i18n(
                        'Availability is temporarily unavailable. Please contact us before booking.',
                        'Les disponibilités sont temporairement indisponibles. Merci de nous contacter avant de réserver.',
                        'De beschikbaarheid is tijdelijk niet beschikbaar. Neem contact met ons op voordat u boekt.'
                    );
                }
                calculateQuote();
            });

        if (submitButton) submitButton.disabled = false;

        bookingForm.addEventListener('submit', async (e) => {
            const quote = calculateQuote();

            if (quote.departureDate && quote.arrivalDate && quote.departureDate <= quote.arrivalDate) {
                e.preventDefault();
                if (formStatus) {
                    formStatus.textContent = i18n(
                        'Departure date must be after arrival date.',
                        "La date de d\u00E9part doit \u00EAtre post\u00E9rieure \u00E0 la date d'arriv\u00E9e.",
                        'Vertrekdatum moet na de aankomstdatum liggen.'
                    );
                    formStatus.className = 'form-status error';
                }
                return;
            }

            if (quote.warning || quote.stayTotal <= 0 || quote.amountDueNow <= 0) {
                e.preventDefault();
                if (formStatus) {
                    formStatus.textContent = quote.warning || i18n(
                        'Please complete dates and guest details first.',
                        'Merci de compl\u00E9ter les dates et le nombre de personnes.',
                        'Vul eerst de datums en gastgegevens in.'
                    );
                    formStatus.className = 'form-status error';
                }
                return;
            }

            if (!stripeCheckoutEndpoint) {
                e.preventDefault();
                if (formStatus) {
                    formStatus.textContent = i18n(
                        'Secure card checkout is unavailable. Please contact us directly.',
                        'Le paiement carte n\u2019est pas disponible pour le moment. Merci de nous contacter directement.',
                        'Beveiligde kaartbetaling is momenteel niet beschikbaar. Neem rechtstreeks contact met ons op.'
                    );
                    formStatus.className = 'form-status error';
                }
                return;
            }

            e.preventDefault();

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.setAttribute('aria-busy', 'true');
            }

            if (formStatus) {
                formStatus.textContent = i18n(
                    'Redirecting to secure Stripe payment...',
                    'Redirection vers le paiement s\u00E9curis\u00E9 Stripe...',
                    'U wordt doorgestuurd naar de beveiligde Stripe-betaling...'
                );
                formStatus.className = 'form-status sending';
            }

            try {
                const payload = {
                    amountDueNow: quote.amountDueNow,
                    stayTotal: quote.stayTotal,
                    balanceDueLater: quote.balanceDueLater,
                    touristTaxEur: quote.touristTax,
                    damageDeposit: quote.damageDeposit,
                    paymentStage: quote.withinFullPaymentWindow ? 'full_payment_now' : 'deposit_now_balance_later',
                    firstName: document.getElementById('firstName')?.value?.trim() || '',
                    lastName: document.getElementById('lastName')?.value?.trim() || '',
                    email: document.getElementById('email')?.value?.trim() || '',
                    phone: document.getElementById('phone')?.value?.trim() || '',
                    message: document.getElementById('message')?.value?.trim() || '',
                    arrivalDate: arrivalInput?.value || '',
                    departureDate: departureInput?.value || '',
                    adults: quote.adults,
                    children: quote.children,
                    guests: quote.guests,
                    nights: quote.nights,
                    agreementAccepted: Boolean(agreementInput?.checked),
                    lang: pageLang.slice(0, 2)
                };

                const signature = JSON.stringify([
                    payload.firstName,
                    payload.lastName,
                    payload.email,
                    payload.phone,
                    payload.message,
                    payload.arrivalDate,
                    payload.departureDate,
                    payload.adults,
                    payload.children
                ]);
                if (signature !== checkoutPayloadSignature) {
                    checkoutPayloadSignature = signature;
                    checkoutRequestId = newCheckoutRequestId();
                }
                payload.requestId = checkoutRequestId;

                const response = await fetch(stripeCheckoutEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.url) {
                    const message = data.code === 'payments_disabled'
                        ? i18n(
                            'Online payments are being prepared. Please contact us directly to reserve these dates.',
                            'Le paiement en ligne est en cours de préparation. Merci de nous contacter directement pour réserver ces dates.',
                            'Online betalen wordt voorbereid. Neem rechtstreeks contact met ons op om deze datums te reserveren.'
                        )
                        : (data.error || `Checkout setup failed (${response.status})`);
                    throw new Error(message);
                }

                window.location.assign(data.url);
            } catch (error) {
                if (formStatus) {
                    const genericMessage = i18n(
                        'Could not start secure card checkout. Please try again or contact us directly.',
                        'Impossible de d\u00E9marrer le paiement carte s\u00E9curis\u00E9. Merci de r\u00E9essayer ou de nous contacter directement.',
                        'De beveiligde kaartbetaling kon niet worden gestart. Probeer het opnieuw of neem direct contact met ons op.'
                    );
                    formStatus.textContent = error?.message || genericMessage;
                    formStatus.className = 'form-status error';
                }
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.removeAttribute('aria-busy');
                }
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
