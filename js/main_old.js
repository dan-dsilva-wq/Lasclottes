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

    /* ---- Hero Slideshow — recursive setTimeout for Safari ---- */
    const slides = document.querySelectorAll('.hero-slide');
    let currentSlide = 0;

    const showSlide = (index) => {
        slides.forEach(s => s.classList.remove('active'));
        if (slides[index]) slides[index].classList.add('active');
    };

    const scheduleNextSlide = () => {
        setTimeout(() => {
            requestAnimationFrame(() => {
                currentSlide = (currentSlide + 1) % slides.length;
                showSlide(currentSlide);
                scheduleNextSlide();
            });
        }, 5500);
    };

    if (slides.length > 1) {
        showSlide(0);
        scheduleNextSlide();
    }

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

    /* ---- Gallery Filters ---- */
    const filterBtns = document.querySelectorAll('.gallery-filter');
    const galleryItems = document.querySelectorAll('.gallery-item');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');
            galleryItems.forEach(item => {
                if (filter === 'all' || item.getAttribute('data-category') === filter) {
                    item.style.display = '';
                    setTimeout(() => item.classList.add('visible'), 10);
                } else {
                    item.classList.remove('visible');
                    item.style.display = 'none';
                }
            });
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

    const openLightbox = (index) => {
        lightboxImages = Array.from(document.querySelectorAll('.gallery-item:not([style*="display: none"]) img'));
        lightboxIndex = index;
        if (lightbox && lightboxImg && lightboxImages[index]) {
            lightboxImg.src = lightboxImages[index].src;
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
            lightboxImg.src = lightboxImages[lightboxIndex].src;
            lightboxImg.alt = lightboxImages[lightboxIndex].alt;
        }
        updateCounter();
    };

    const showLightboxNext = () => {
        lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
        if (lightboxImg && lightboxImages[lightboxIndex]) {
            lightboxImg.src = lightboxImages[lightboxIndex].src;
            lightboxImg.alt = lightboxImages[lightboxIndex].alt;
        }
        updateCounter();
    };

    const updateCounter = () => {
        if (lightboxCounter) {
            lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
        }
    };

    galleryItems.forEach((item, i) => {
        item.addEventListener('click', () => {
            const visibleItems = Array.from(document.querySelectorAll('.gallery-item:not([style*="display: none"])'));
            const visibleIndex = visibleItems.indexOf(item);
            openLightbox(visibleIndex >= 0 ? visibleIndex : i);
        });
        item.style.cursor = 'pointer';
    });

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

    /* ---- Form Validation ---- */
    const bookingForm = document.getElementById('bookingForm');
    const formStatus = document.getElementById('formStatus');

    if (bookingForm) {
        const arrivalInput = document.getElementById('arrivalDate');
        const departureInput = document.getElementById('departureDate');

        if (arrivalInput) {
            const today = new Date().toISOString().split('T')[0];
            arrivalInput.min = today;
            arrivalInput.addEventListener('change', () => {
                if (departureInput) {
                    departureInput.min = arrivalInput.value;
                }
            });
        }

        bookingForm.addEventListener('submit', (e) => {
            if (arrivalInput && departureInput) {
                if (new Date(departureInput.value) <= new Date(arrivalInput.value)) {
                    e.preventDefault();
                    if (formStatus) {
                        formStatus.textContent = 'Departure date must be after arrival date.';
                        formStatus.className = 'form-status error';
                    }
                    return;
                }
            }

            if (formStatus) {
                formStatus.textContent = 'Sending your booking request…';
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
