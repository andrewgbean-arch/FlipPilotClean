/**
 * A vehicle's MOT details (expiry, tax, advisories, failures, mileage history) belong to one plate.
 * If the registration in the form is changed after a lookup, those details describe a different car,
 * so they must not be saved against the new plate.
 */
const norm = (reg?: string | null) => String(reg ?? "").replace(/\s+/g, "").toUpperCase();

export const sameReg = (a?: string | null, b?: string | null) => norm(a) === norm(b);
