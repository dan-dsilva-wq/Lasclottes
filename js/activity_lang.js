(() => {
    const translations = {
        fr: {
            htmlLang: 'fr',
            activities: 'Activités',
            book: 'Réserver',
            bookNow: 'Réserver',
            exploreMore: 'Explorer Plus d\'Activités',
            planMore: 'Préparez votre séjour avec plus d\'activités autour de Lasclottes.',
            backToActivities: '\u2190 Retour aux Activités',
            englishGuideNotice: 'Ce guide détaillé est actuellement en anglais. La navigation et les liens de réservation restent en français.',
            currentInfoNotice: 'Les horaires, disponibilités et tarifs peuvent changer. Vérifiez le site officiel indiqué avant de vous déplacer.',
            relatedLabels: {
                'Fishing': 'Pêche',
                'Cycling': 'Cyclisme',
                'Canoeing & Kayaking': 'Canoë & Kayak',
                'Golf': 'Golf',
                'Markets & Dining': 'Marchés & Restaurants',
                'Wine & Chateaux': 'Vins & Châteaux',
                'Medieval Villages': 'Villages Médiévaux',
                'Hot Air Balloons': 'Montgolfières',
                'Water Sports': 'Sports Nautiques',
                "Children's Activities": 'Activités Enfants'
            },
            homePage: '../fr.html'
        },
        nl: {
            htmlLang: 'nl',
            activities: 'Activiteiten',
            book: 'Boeken',
            bookNow: 'Boek nu',
            exploreMore: 'Ontdek Meer Activiteiten',
            planMore: 'Plan uw verblijf met meer activiteiten rond Lasclottes.',
            backToActivities: '\u2190 Terug naar Activiteiten',
            englishGuideNotice: 'Deze uitgebreide gids is momenteel in het Engels. De navigatie en boekingslinks blijven in het Nederlands.',
            currentInfoNotice: 'Openingstijden, beschikbaarheid en prijzen kunnen veranderen. Controleer vóór vertrek de vermelde officiële website.',
            relatedLabels: {
                'Fishing': 'Vissen',
                'Cycling': 'Fietsen',
                'Canoeing & Kayaking': 'Kanoën & Kajakken',
                'Golf': 'Golf',
                'Markets & Dining': 'Markten & Eten',
                'Wine & Chateaux': 'Wijn & Châteaux',
                'Medieval Villages': 'Middeleeuwse Dorpen',
                'Hot Air Balloons': 'Luchtballonnen',
                'Water Sports': 'Watersporten',
                "Children's Activities": 'Kinderactiviteiten'
            },
            homePage: '../nl.html'
        }
    };

    const url = new URL(window.location.href);
    const langParam = (url.searchParams.get('lang') || '').toLowerCase();
    if (!translations[langParam]) return;

    const t = translations[langParam];
    const appendLang = (href) => {
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return href;
        if (/^https?:\/\//i.test(href)) return href;

        const hashIndex = href.indexOf('#');
        const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
        const rawPath = hashIndex >= 0 ? href.slice(0, hashIndex) : href;

        const linkUrl = new URL(rawPath, window.location.href);
        if (!linkUrl.pathname.endsWith('.html')) return href;

        if (!linkUrl.pathname.includes('/activities/')) return href;

        linkUrl.searchParams.set('lang', langParam);
        return `${linkUrl.pathname}${linkUrl.search}${hash}`;
    };

    const setText = (selector, text) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = text;
    };

    document.documentElement.lang = t.htmlLang;

    const activityHero = document.querySelector('.activity-hero');
    if (activityHero) {
        const languageNotice = document.createElement('p');
        languageNotice.className = 'activity-lang-notice';
        languageNotice.setAttribute('role', 'note');
        languageNotice.textContent = t.englishGuideNotice;
        activityHero.insertAdjacentElement('beforebegin', languageNotice);
    }

    // Keep visitors in the selected language context.
    document.querySelectorAll('a[href]').forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        const updated = appendLang(href);
        if (updated !== href) link.setAttribute('href', updated);
    });

    const logo = document.querySelector('.nav__logo');
    if (logo) logo.setAttribute('href', `${t.homePage}#activities`);

    const navLinks = document.querySelectorAll('.nav__list .nav__link');
    if (navLinks[0]) {
        navLinks[0].textContent = t.activities;
        navLinks[0].setAttribute('href', `${t.homePage}#activities`);
    }
    if (navLinks[1]) {
        navLinks[1].textContent = t.book;
        navLinks[1].setAttribute('href', `${t.homePage}#contact`);
    }

    const navCta = document.querySelector('.nav__actions .nav__cta');
    if (navCta) {
        navCta.textContent = t.bookNow;
        navCta.setAttribute('href', `${t.homePage}#contact`);
    }

    const ctaBannerBtn = document.querySelector('.cta-banner .btn');
    if (ctaBannerBtn) {
        ctaBannerBtn.textContent = t.bookNow;
        ctaBannerBtn.setAttribute('href', `${t.homePage}#contact`);
    }

    const backBtn = document.querySelector('.back-link .btn');
    if (backBtn) {
        backBtn.textContent = t.backToActivities;
        backBtn.setAttribute('href', `${t.homePage}#activities`);
    }

    setText('.related-activities h2', t.exploreMore);
    setText('.related-activities p', t.planMore);
    setText('.activity-current-info', t.currentInfoNotice);

    document.querySelectorAll('.related-activities__link').forEach((el) => {
        const label = el.textContent.trim();
        if (t.relatedLabels[label]) {
            el.textContent = t.relatedLabels[label];
        }
    });
})();
