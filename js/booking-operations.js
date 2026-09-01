'use strict';

(() => {
    const login = document.getElementById('operations-login');
    const tokenInput = document.getElementById('operations-token');
    const status = document.getElementById('operations-status');
    const results = document.getElementById('operations-results');
    const issueRows = document.getElementById('operations-issues');
    const refresh = document.getElementById('operations-refresh');
    const lock = document.getElementById('operations-lock');
    let accessToken = '';

    const setStatus = (message) => {
        status.textContent = message;
    };

    const request = async (method = 'GET', body) => {
        const response = await fetch('/api/booking-operations', {
            method,
            cache: 'no-store',
            credentials: 'same-origin',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(data.error || 'Booking operations are unavailable.');
            error.status = response.status;
            throw error;
        }
        return data;
    };

    const cell = (text) => {
        const element = document.createElement('td');
        element.textContent = text;
        return element;
    };

    const kindLabel = (kind) => ({
        guest_payment_confirmation: 'Guest payment confirmation',
        owner_booking_notification: 'Sally paid-booking alert',
        monitor_booking_notification: 'Daniel paid-booking alert',
        owner_checkout_started: 'Sally checkout-started alert',
        monitor_checkout_started: 'Daniel checkout-started alert'
    })[kind] || 'Booking notification';

    const retry = async (issue, button) => {
        const confirmed = window.confirm(`Retry the ${kindLabel(issue.kind).toLowerCase()} for ${issue.reference}? This sends an email but cannot charge the guest.`);
        if (!confirmed) return;
        button.disabled = true;
        setStatus(`Retrying ${issue.reference}…`);
        try {
            await request('POST', {
                action: 'retry_email',
                reference: issue.reference,
                kind: issue.kind
            });
            setStatus(`The ${kindLabel(issue.kind).toLowerCase()} for ${issue.reference} was submitted safely.`);
            await loadIssues();
        } catch (error) {
            setStatus(error.message);
            button.disabled = false;
        }
    };

    const renderIssues = (issues) => {
        issueRows.replaceChildren();
        if (!issues.length) {
            const row = document.createElement('tr');
            const empty = cell('No failed booking emails need attention.');
            empty.colSpan = 5;
            row.append(empty);
            issueRows.append(row);
            return;
        }
        for (const issue of issues) {
            const row = document.createElement('tr');
            row.append(cell(`${issue.reference}\n${issue.arrival} – ${issue.departure}`));
            row.append(cell(`${issue.guestName}\n${issue.guestEmail}\n${issue.guestPhone}`));
            row.append(cell(kindLabel(issue.kind)));
            row.append(cell(`${issue.status}${issue.detail ? `: ${issue.detail}` : ''}\nAttempts: ${issue.attempts}`));
            const action = document.createElement('td');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-primary btn-sm';
            button.textContent = 'Retry email';
            button.addEventListener('click', () => retry(issue, button));
            action.append(button);
            row.append(action);
            issueRows.append(row);
        }
    };

    async function loadIssues() {
        setStatus('Checking booking email delivery…');
        try {
            const data = await request();
            renderIssues(Array.isArray(data.issues) ? data.issues : []);
            results.hidden = false;
            setStatus(data.issues?.length
                ? `${data.issues.length} booking email${data.issues.length === 1 ? '' : 's'} need attention.`
                : 'All recorded booking emails are clear.');
        } catch (error) {
            results.hidden = true;
            if (error.status === 401) accessToken = '';
            setStatus(error.message);
        }
    }

    login.addEventListener('submit', async (event) => {
        event.preventDefault();
        const candidate = tokenInput.value.trim();
        if (candidate.length < 32) {
            setStatus('The operations access key is not valid.');
            return;
        }
        accessToken = candidate;
        tokenInput.value = '';
        await loadIssues();
    });

    refresh.addEventListener('click', loadIssues);
    lock.addEventListener('click', () => {
        accessToken = '';
        issueRows.replaceChildren();
        results.hidden = true;
        setStatus('The page is locked. Enter the operations access key to continue.');
        tokenInput.focus();
    });
})();
