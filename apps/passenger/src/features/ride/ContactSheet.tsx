/**
 * Calling or messaging the chauffeuse through Naya needs a telephony provider (number masking).
 * None is configured, so the ride screen shows no contact action at all while it is not live (R8):
 * no greyed rows and no « Bientôt disponible ». The former contact sheet only held the emergency
 * numbers, which now live in the safety sheet (X-02, P-57): the 19 is its own button there, and
 * `OtherEmergencyNumbers` (shared with the driver app, in @naya/ui) lists the other numbers under it.
 */
export { OtherEmergencyNumbers } from '@naya/ui';
