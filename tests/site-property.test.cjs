'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('each language accurately distinguishes the current accommodation from the 2028 farmhouse', () => {
    const pages = [
        {
            file: 'index.html',
            current: [/five bedrooms/i, /four bathrooms/i],
            future: [/Farmhouse[^<]*Opening 2028/i, /seven bedrooms and five bathrooms/i]
        },
        {
            file: 'fr.html',
            current: [/cinq chambres/i, /quatre salles de bain/i],
            future: [/Corps de Ferme[^<]*ouverture en 2028/i, /sept chambres et cinq salles de bain/i]
        },
        {
            file: 'nl.html',
            current: [/vijf slaapkamers/i, /vier badkamers/i],
            future: [/boerderij[^<]*open vanaf 2028/i, /zeven slaapkamers en vijf badkamers/i]
        }
    ];

    for (const page of pages) {
        const html = read(page.file);
        for (const claim of [...page.current, ...page.future]) {
            assert.match(html, claim, `${page.file}: missing accommodation claim ${claim}`);
        }
    }

    const french = read('fr.html');
    assert.doesNotMatch(french, /Avec sept chambres|4 chambres \(8 couchages\)|3 chambres \(4 à 6 couchages\)/i);
    assert.match(french, /<span class="hero__stat-number">2<\/span>\s*<span class="hero__stat-label">Hectares<\/span>/i);
    assert.doesNotMatch(french, />Acres</i);

    const dutch = read('nl.html');
    assert.doesNotMatch(dutch, />Bijlage<|zonder bijlage|The Granary/i);
    assert.match(dutch, /<span class="hero__stat-number">2<\/span>\s*<span class="hero__stat-label">Hectare<\/span>/i);
    assert.doesNotMatch(dutch, />Acres</i);
});
