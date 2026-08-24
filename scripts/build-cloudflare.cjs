'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'dist');
const directories = ['activities', 'Media'];
const files = [
    '404.html',
    'booking-terms.html',
    'favicon.ico',
    'fr.html',
    'index.html',
    'nl.html',
    'payment-cancelled.html',
    'payment-success.html',
    'privacy.html',
    'robots.txt',
    'sitemap.xml'
];

fs.rmSync(destination, { force: true, recursive: true });
fs.mkdirSync(destination, { recursive: true });

for (const directory of directories) {
    fs.cpSync(path.join(root, directory), path.join(destination, directory), { recursive: true });
}
fs.mkdirSync(path.join(destination, 'css'), { recursive: true });
fs.copyFileSync(path.join(root, 'css', 'style.css'), path.join(destination, 'css', 'style.css'));
fs.mkdirSync(path.join(destination, 'js'), { recursive: true });
for (const file of ['activity_lang.js', 'main.js']) {
    fs.copyFileSync(path.join(root, 'js', file), path.join(destination, 'js', file));
}
fs.mkdirSync(path.join(destination, 'data'), { recursive: true });
fs.copyFileSync(
    path.join(root, 'data', 'availability.json'),
    path.join(destination, 'data', 'availability.json')
);
for (const file of files) {
    fs.copyFileSync(path.join(root, file), path.join(destination, file));
}
for (const file of ['_headers', '_redirects']) {
    fs.copyFileSync(path.join(root, 'cloudflare', file), path.join(destination, file));
}

const publishedFiles = [];
const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(fullPath);
        else publishedFiles.push(fullPath);
    }
};
visit(destination);

const oversized = publishedFiles.filter((file) => fs.statSync(file).size > 25 * 1024 * 1024);
if (oversized.length) {
    throw new Error(`Cloudflare's 25 MiB asset limit is exceeded by: ${oversized.join(', ')}`);
}
console.log(`Prepared ${publishedFiles.length} publishable files for Cloudflare.`);
