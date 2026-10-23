/**
 * Lao phone numbers as HAL stores them, turned into WhatsApp ids.
 *
 * HAL keeps mobile numbers without the 020 prefix ("97364057"), staff type
 * them with it ("02078331163"), and some arrive international ("+856 20 …").
 * All of them are the same WhatsApp account: 8562097364057@c.us.
 */

/** Digits only in international form (8562097364057), or null if unusable. */
export function toLaoMsisdn(raw: string | null | undefined): string | null {
  if (!raw || raw.includes("*")) return null; // masked by HAL: 020****5048

  let n = raw.replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("856")) n = n.slice(3);
  if (n.startsWith("0")) n = n.slice(1);

  if (/^\d{8}$/.test(n)) n = `20${n}`; // mobile stored without 020

  if (/^20\d{8}$/.test(n)) return `856${n}`; // mobile 020 xxxx xxxx
  if (/^30\d{7}$/.test(n)) return `856${n}`; // 030 xxx xxxx
  return null;
}

export function toChatId(msisdn: string): string {
  return `${msisdn}@c.us`;
}

/** 8562097364057 → 020 9736 4057, for showing to staff. */
export function formatLaoPhone(raw: string | null | undefined): string {
  const n = toLaoMsisdn(raw);
  if (!n) return raw ?? "—";
  const local = `0${n.slice(3)}`;
  return local.length === 11
    ? `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`
    : `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/**
 * Why a receiver can't be sent a WhatsApp message, in Lao for staff, or null
 * if the number looks sendable. 030 numbers are landline-style lines that
 * rarely have WhatsApp, so they are not sent to.
 */
export function phoneProblem(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return "ບໍ່ມີເບີໂທ";
  if (raw.includes("*")) return "ເບີຖືກປິດ (***)";

  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("856")) d = d.slice(3);
  if (d.startsWith("030") || (d.startsWith("30") && d.length === 9)) return "ເບີ 030";

  if (toLaoMsisdn(raw)) return null;
  const local = d.replace(/^0/, "");
  if (local.length > 0 && local.length < 8) return `ເບີມີແຕ່ ${local.length} ໂຕ`;
  return "ເບີຜິດ";
}
