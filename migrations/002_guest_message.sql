ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS guest_message text NOT NULL DEFAULT '';
