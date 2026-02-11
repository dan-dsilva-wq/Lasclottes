/* ============================================================
   Lasclottes — Main JS (vanilla, no dependencies)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const nav = document.getElementById('nav');

    /* 1. Mobile menu */
    const toggle = document.getElementById('navToggle');
    const mobileMenu = document.getElementById('mobileMenu');

    const closeMenu = () => {
        body.classList.remove('menu-open');
        toggle?.setAttribute('aria-expanded', 'false');
    };

    toggle?.addEventListener('click', () => {
        const open = body.classList.toggle('menu-open');
        toggle.setAttribute('aria-expanded', String(open));
    });

    mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeMenu(); closeLightbox(); }
    });

    /* 2. Sticky nav */
    const onNavScroll = () => nav?.classList.toggle('nav--scrolled', window.scrollY > 80);

    /* 3. Hero slideshow */
    const slides = document.querySelectorAll('.hero__slide');
    let cur = 0, timer = null;
    const show = i => { slides.forEach(s => s.classList.remove('active')); slides[i]?.classList.add('active'); };
    const next = () => { cur = (cur + 1) % slides.length; show(cur); };
    const start = () => { timer = setInterval(next, 5500); };
    const stop = () => clearInterval(timer);

    if (slides.length > 1) {
        show(0); start();
        const hero = document.querySelector('.hero');
        hero?.addEventListener('mouseenter', stop);
        hero?.addEventListener('mouseleave', start);
    }

    /* 4. Smooth scroll + active nav highlight */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const id = a.getAttribute('href');
            if (id === '#') return;
            const el = document.querySelector(id);
            if (!el) return;
            e.preventDefault();
            const off = nav?.offsetHeight || 0;
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth' });
        });
    });

    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link');
    const secObs = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (en.isIntersecting) {
                const id = en.target.id;
                navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
            }
        });
    }, { rootMargin: '-20% 0px -80% 0px' });
    sections.forEach(s => secObs.observe(s));

    /* 5. Gallery lightbox */
    const lightbox = document.getElementById('lightbox');
    const lbImg = lightbox?.querySelector('.lightbox__img');
    const lbCounter = lightbox?.querySelector('.lightbox__counter');
    let lbIdx = 0, visible = [], touchX = 0;

    const getVisible = () => [...document.querySelectorAll('.gi')].filter(i => !i.classList.contains('hidden'));

    const updateLb = () => {
        const img = visible[lbIdx]?.querySelector('img');
        if (lbImg && img) { lbImg.src = img.src; lbImg.alt = img.alt || ''; }
        if (lbCounter) lbCounter.textContent = `${lbIdx + 1} / ${visible.length}`;
    };

    const openLightbox = idx => {
        visible = getVisible();
        if (!visible.length) return;
        lbIdx = idx;
        updateLb();
        lightbox?.removeAttribute('hidden');
        body.classList.add('lightbox-open');
    };

    const closeLightbox = () => {
        if (!lightbox || lightbox.hasAttribute('hidden')) return;
        lightbox.setAttribute('hidden', '');
        body.classList.remove('lightbox-open');
    };

    const lbNav = dir => { lbIdx = (lbIdx + dir + visible.length) % visible.length; updateLb(); };

    document.querySelectorAll('.gi').forEach(item => {
        item.addEventListener('click', () => openLightbox(getVisible().indexOf(item)));
    });

    lightbox?.querySelector('.lightbox__close')?.addEventListener('click', closeLightbox);
    lightbox?.querySelector('.lightbox__prev')?.addEventListener('click', () => lbNav(-1));
    lightbox?.querySelector('.lightbox__next')?.addEventListener('click', () => lbNav(1));
    lightbox?.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

    document.addEventListener('keydown', e => {
        if (lightbox?.hasAttribute('hidden')) return;
        if (e.key === 'ArrowLeft') lbNav(-1);
        if (e.key === 'ArrowRight') lbNav(1);
    });

    lightbox?.addEventListener('touchstart', e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lightbox?.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) lbNav(dx > 0 ? -1 : 1);
    }, { passive: true });

    /* 6. Gallery filters */
    const filterBtns = document.querySelectorAll('.gf');
    const galleryItems = document.querySelectorAll('.gi');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.filter;
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            galleryItems.forEach(item => {
                const match = cat === 'all' || item.dataset.cat === cat;
                item.classList.toggle('hidden', !match);
            });
        });
    });

    /* 7. Booking form */
    const form = document.getElementById('bookingForm');
    const formStatus = document.getElementById('formStatus');
    const WISE_URL = '';

    const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    const showMsg = (type, text) => {
        if (!formStatus) return;
        formStatus.className = `form-status ${type}`;
        formStatus.textContent = text;
    };

    if (form) {
        const redirect = document.getElementById('formRedirect');
        if (redirect && WISE_URL) redirect.value = WISE_URL;
    }

    form?.addEventListener('submit', e => {
        let ok = true;
        form.querySelectorAll('[required]').forEach(f => {
            if (f.type === 'checkbox') {
                f.classList.toggle('error', !f.checked);
                if (!f.checked) ok = false;
            } else {
                const v = f.value.trim() !== '';
                f.classList.toggle('error', !v);
                if (!v) ok = false;
            }
        });
        const em = form.querySelector('[type="email"]');
        if (em && !validEmail(em.value)) { em.classList.add('error'); ok = false; }
        if (!ok) {
            e.preventDefault();
            showMsg('error', 'Please fill in all required fields and accept the agreement.');
        }
    });

    /* 8. Mobile sticky bar */
    const mobileBar = document.getElementById('mobileBar');
    const heroEl = document.querySelector('.hero');
    const onBarScroll = () => {
        if (!mobileBar || !heroEl) return;
        mobileBar.classList.toggle('visible', window.scrollY > heroEl.offsetTop + heroEl.offsetHeight);
    };

    /* 9. Scroll reveal */
    const revealObs = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (en.isIntersecting) { en.target.classList.add('visible'); revealObs.unobserve(en.target); }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

    /* 10. Lazy-load iframes */
    const iframeObs = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (en.isIntersecting && en.target.dataset.src) {
                en.target.src = en.target.dataset.src;
                en.target.removeAttribute('data-src');
                iframeObs.unobserve(en.target);
            }
        });
    }, { rootMargin: '200px' });
    document.querySelectorAll('iframe[data-src]').forEach(f => iframeObs.observe(f));

    /* Throttled scroll */
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => { onNavScroll(); onBarScroll(); ticking = false; });
            ticking = true;
        }
    }, { passive: true });

    onNavScroll();
    onBarScroll();
});
