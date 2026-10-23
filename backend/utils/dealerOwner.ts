/**
 * A dealership that lists through FlipPilot Dealer OS owns its listings under an
 * id starting with this. A phone's device id may never start with it (the
 * account guard refuses one), so nobody can act as a dealership by naming its id;
 * only the Dealer OS server, holding the bridge key, can.
 */
export const DEALER_OWNER_PREFIX = "dealer:";

export const isDealerOwner = (id: unknown): boolean => typeof id === "string" && id.startsWith(DEALER_OWNER_PREFIX);

export const dealerOwnerId = (dealershipId: string): string => `${DEALER_OWNER_PREFIX}${dealershipId}`;
